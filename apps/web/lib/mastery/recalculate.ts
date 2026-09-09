import 'server-only'

import { calculateMastery } from '@zihin/core'
import type { MasteryResult, MasteryStatus } from '@zihin/core'
import type { DataClient } from '@/lib/data/client'
import { AppError } from '@/lib/errors'
import {
  dedupeTopicIds,
  isWeakToStrongTransition,
  toAttemptLikes,
  type MasteryAttemptRow,
} from './mapping'

/**
 * Yetkinlik yeniden hesaplama servisi.
 *
 * Spec §M6: yetkinlik paneli bir çözümden en geç 2 saniye sonra güncel olmalı.
 * Bu yüzden hesap arka plana atılmaz, test/checkpoint gönderiminden hemen sonra
 * SENKRON çalışır. Bedeli sınırlı tutulur: konu başına tek deneme sorgusu,
 * kullanıcı başına tek "önceki durum" sorgusu ve tek toplu upsert.
 *
 * İstemci `topic_mastery`'ye yazamaz (RLS); bu yüzden her fonksiyon
 * `createSupabaseAdminClient()` ile üretilmiş service-role istemcisi bekler.
 * `userId` her zaman sunucuda doğrulanmış oturumdan gelir (CONVENTIONS §4).
 */

/** Core'un hesaba kattığı pencere; daha fazlasını çekmenin faydası yok. */
const ATTEMPT_WINDOW = 30

/**
 * Tek bir konunun yeniden hesaplanmış yetkinliği.
 * `previousStatus` null ise o konu için daha önce hiç kayıt yoktu.
 */
export type MasteryRecalculation = {
  topicId: string
  result: MasteryResult
  previousMastery: number | null
  previousStatus: MasteryStatus | null
  /** `weak → strong` geçişi oldu mu — Faz 6'daki `weak_to_strong` rozetinin tetiği. */
  becameStrong: boolean
}

type PreviousRow = { mastery: number; status: MasteryStatus }

/**
 * Bir kullanıcının tek bir konudaki yetkinliğini yeniden hesaplar ve yazar.
 * Önceki durumu da döndürür; çağıran zayıf→güçlü geçişini bundan anlar.
 */
export async function recalculateTopicMastery(
  admin: DataClient,
  userId: string,
  topicId: string,
): Promise<MasteryRecalculation> {
  const [only] = await recalculateForAttempts(admin, userId, [topicId])
  if (!only) {
    // dedupeTopicIds boş id'yi eler; buraya düşmek çağıranın hatasıdır.
    throw new AppError('validation', 'Yetkinlik hesabı için geçerli bir konu verilmedi.')
  }
  return only
}

/**
 * Bir gönderimde dokunulan konuların hepsini yeniden hesaplar.
 * Konu kimlikleri tekilleştirilir: aynı konudan on soru çözülmüş olması
 * hesabı on kez çalıştırmaz.
 */
export async function recalculateForAttempts(
  admin: DataClient,
  userId: string,
  topicIds: readonly string[],
): Promise<MasteryRecalculation[]> {
  const ids = dedupeTopicIds(topicIds)
  if (ids.length === 0) return []

  const previous = await loadPreviousMastery(admin, userId, ids)

  const calculated = await Promise.all(
    ids.map(async (topicId) => {
      const rows = await loadAttemptRows(admin, userId, topicId)
      return { topicId, result: calculateMastery(toAttemptLikes(rows)) }
    }),
  )

  const calculatedAt = new Date().toISOString()
  await writeMastery(
    admin,
    calculated.map((entry) => ({
      user_id: userId,
      topic_id: entry.topicId,
      mastery: entry.result.mastery,
      status: entry.result.status,
      attempts_count: entry.result.n,
      last_calculated_at: calculatedAt,
    })),
  )

  return calculated.map((entry) => {
    const before = previous.get(entry.topicId) ?? null
    return {
      topicId: entry.topicId,
      result: entry.result,
      previousMastery: before?.mastery ?? null,
      previousStatus: before?.status ?? null,
      becameStrong: isWeakToStrongTransition(before?.status ?? null, entry.result.status),
    }
  })
}

/**
 * Hesaplamayı çağırır ama HATA FIRLATMAZ.
 *
 * Kullanılacağı yer bellidir: bir test bitirme ya da checkpoint cevabı. Puanlama
 * aksaklığı öğrencinin cevabını kaybettirmemeli — hata loglanır, akış devam eder.
 */
export async function recalculateQuietly(
  admin: DataClient,
  userId: string,
  topicIds: readonly string[],
): Promise<MasteryRecalculation[]> {
  try {
    return await recalculateForAttempts(admin, userId, topicIds)
  } catch (error) {
    console.error('[mastery] yeniden hesaplama başarısız:', error)
    return []
  }
}

/** Konunun son `ATTEMPT_WINDOW` denemesi, sorunun zorluk/süre bilgisiyle birlikte. */
async function loadAttemptRows(
  admin: DataClient,
  userId: string,
  topicId: string,
): Promise<MasteryAttemptRow[]> {
  const { data, error } = await admin
    .from('attempts')
    .select(
      'question_id, is_correct, time_spent_ms, answered_at, repeat_index, questions(difficulty, expected_seconds)',
    )
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .order('answered_at', { ascending: false })
    .limit(ATTEMPT_WINDOW)

  if (error) throw new AppError('internal', 'Çözüm geçmişi okunamadı.')

  // Üretilen tiplerde `Relationships` boş olduğu için gömülü ilişki tip
  // çıkarımına girmiyor; şekli burada elle bildiriyoruz.
  const rows = (data ?? []) as unknown as Array<{
    question_id: string
    is_correct: boolean
    time_spent_ms: number
    answered_at: string
    repeat_index: number
    questions: { difficulty: number | null; expected_seconds: number | null } | null
  }>

  return rows.map((row) => ({
    question_id: row.question_id,
    is_correct: row.is_correct,
    time_spent_ms: row.time_spent_ms,
    answered_at: row.answered_at,
    repeat_index: row.repeat_index,
    difficulty: row.questions?.difficulty ?? null,
    expected_seconds: row.questions?.expected_seconds ?? null,
  }))
}

/** Yazmadan ÖNCEKİ durumlar — geçiş saptaması için tek sorguda toplanır. */
async function loadPreviousMastery(
  admin: DataClient,
  userId: string,
  topicIds: string[],
): Promise<Map<string, PreviousRow>> {
  const { data, error } = await admin
    .from('topic_mastery')
    .select('topic_id, mastery, status')
    .eq('user_id', userId)
    .in('topic_id', topicIds)

  if (error) throw new AppError('internal', 'Yetkinlik bilgisi yüklenemedi.')

  const map = new Map<string, PreviousRow>()
  for (const row of data ?? []) {
    map.set(row.topic_id, { mastery: row.mastery, status: row.status })
  }
  return map
}

type MasteryUpsertRow = {
  user_id: string
  topic_id: string
  mastery: number
  status: MasteryStatus
  attempts_count: number
  last_calculated_at: string
}

async function writeMastery(admin: DataClient, rows: MasteryUpsertRow[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await admin
    .from('topic_mastery')
    .upsert(rows, { onConflict: 'user_id,topic_id' })

  if (error) throw new AppError('internal', 'Yetkinlik güncellenemedi.')
}
