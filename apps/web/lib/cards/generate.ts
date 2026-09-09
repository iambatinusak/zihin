import 'server-only'

import type { DataClient } from '@/lib/data/client'
import { parseOptions } from '@/lib/questions/options'
import { buildCardBack, buildCardFront, type CardSourceQuestion } from './card-content'

/**
 * Yanlış cevaplardan otomatik hafıza kartı üretimi (spec §M9).
 *
 * Ürünün çekirdek döngüsü budur: öğrenci bir soruyu yanlış çözer, o sorunun
 * doğrusu ertesi gün kart olarak karşısına çıkar.
 *
 * SERVICE-ROLE ZORUNLUDUR. İki sebeple:
 *   1. Doğru cevap ve açıklama `public.questions` üzerinde `authenticated`
 *      rolünden geri alınmıştır (0011_rls_policies.sql, "üç katmanlı savunma");
 *      kartın arka yüzü ancak service-role ile okunabilir.
 *   2. `flashcards` tablosuna yazma yalnızca editöre açıktır; otomatik kartı
 *      da sunucu yazar (aynı dosyadaki `flashcards_insert_editor` yorumu).
 *
 * `userId` HER ZAMAN doğrulanmış oturumdan gelir, istekten değil
 * (CONVENTIONS §4).
 */

/** Oturum verilmediğinde taranacak en fazla yanlış cevap. */
const MAX_WRONG_ATTEMPTS = 200

export type GenerateCardsResult = {
  /** Bu çağrıda gerçekten açılan kart sayısı. */
  created: number
  /** Zaten kartı olduğu için atlanan soru sayısı. */
  skipped: number
}

/**
 * Kullanıcının yanlış cevapladığı sorulardan kart üretir.
 *
 * `sessionId` verilirse yalnızca o test oturumu taranır; verilmezse
 * kullanıcının en yeni `MAX_WRONG_ATTEMPTS` yanlışı taranır.
 *
 * KAPSAM: `is_correct = false` VE bir şık işaretlenmiş denemeler. Boş bırakılan
 * sorular dışarıdadır — sonuç ekranındaki "yanlış" sayacı da aynı tanımı
 * kullanıyor; düğmenin üzerindeki sayı ile üretilen kart sayısı örtüşmeli.
 *
 * YİNELENME: `(created_by, source_question_id) where auto_generated` kısmi
 * tekil indeksi (0004_content.sql) ikinci kartı engeller. Önce var olanlar
 * elenir, kalan yarışta 23505 sessizce yutulur — okuma-sonra-yazma yarışını
 * kilitle çözmeye çalışmak yerine indekse güvenilir.
 */
export async function generateCardsFromWrongAnswers(
  adminClient: DataClient,
  userId: string,
  sessionId?: string,
): Promise<GenerateCardsResult> {
  const questionIds = await findWrongQuestionIds(adminClient, userId, sessionId)
  if (questionIds.length === 0) return { created: 0, skipped: 0 }

  const existing = await findExistingSourceQuestionIds(adminClient, userId, questionIds)
  const pending = questionIds.filter((id) => !existing.has(id))
  if (pending.length === 0) return { created: 0, skipped: questionIds.length }

  const questions = await readSourceQuestions(adminClient, pending)
  if (questions.length === 0) return { created: 0, skipped: questionIds.length }

  const rows = questions.map((question) => ({
    topic_id: question.topicId,
    front: buildCardFront(question),
    back: buildCardBack(question),
    auto_generated: true,
    source_question_id: question.id,
    created_by: userId,
    is_published: true,
  }))

  const created = await insertCards(adminClient, rows)
  return { created, skipped: questionIds.length - created }
}

/** Hata fırlatmayan sarmalayıcı: kart üretimi asıl akışı (test bitirme) bozmaz. */
export async function generateCardsQuietly(
  adminClient: DataClient,
  userId: string,
  sessionId?: string,
): Promise<GenerateCardsResult> {
  try {
    return await generateCardsFromWrongAnswers(adminClient, userId, sessionId)
  } catch (error) {
    console.error('[cards] otomatik kart üretimi başarısız:', error)
    return { created: 0, skipped: 0 }
  }
}

/** Yanlış cevaplanan (ve boş bırakılmamış) soruların kimlikleri, tekilleştirilmiş. */
async function findWrongQuestionIds(
  adminClient: DataClient,
  userId: string,
  sessionId?: string,
): Promise<string[]> {
  let query = adminClient
    .from('attempts')
    .select('question_id')
    .eq('user_id', userId)
    .eq('is_correct', false)
    .not('selected_option', 'is', null)

  if (sessionId) {
    query = query.eq('test_session_id', sessionId)
  } else {
    query = query.order('answered_at', { ascending: false }).limit(MAX_WRONG_ATTEMPTS)
  }

  const { data, error } = await query
  if (error) throw new Error(`Yanlış cevaplar okunamadı: ${error.message}`)

  return [...new Set((data ?? []).map((row) => row.question_id))]
}

/** Bu sorulardan zaten kart üretilmiş olanlar. */
async function findExistingSourceQuestionIds(
  adminClient: DataClient,
  userId: string,
  questionIds: readonly string[],
): Promise<Set<string>> {
  const { data, error } = await adminClient
    .from('flashcards')
    .select('source_question_id')
    .eq('created_by', userId)
    .eq('auto_generated', true)
    .in('source_question_id', [...questionIds])

  if (error) throw new Error(`Mevcut kartlar okunamadı: ${error.message}`)

  return new Set(
    (data ?? []).flatMap((row) => (row.source_question_id ? [row.source_question_id] : [])),
  )
}

/** Kartın iki yüzünü kuracak soru bilgisi. Yalnızca service-role okuyabilir. */
async function readSourceQuestions(
  adminClient: DataClient,
  questionIds: readonly string[],
): Promise<CardSourceQuestion[]> {
  const { data, error } = await adminClient
    .from('questions')
    .select('id, topic_id, stem, options, correct_option, explanation, deleted_at')
    .in('id', [...questionIds])
    .is('deleted_at', null)

  if (error) throw new Error(`Soru içeriği okunamadı: ${error.message}`)

  return (data ?? []).flatMap((row) => {
    // Doğru şıkkı olmayan bir sorudan kartın arka yüzü kurulamaz; sessizce atlanır.
    if (!row.correct_option) return []
    return [
      {
        id: row.id,
        topicId: row.topic_id,
        stem: row.stem,
        options: parseOptions(row.options),
        correctOption: row.correct_option,
        explanation: row.explanation,
      },
    ]
  })
}

type CardInsert = {
  topic_id: string
  front: string
  back: string
  auto_generated: boolean
  source_question_id: string
  created_by: string
  is_published: boolean
}

/**
 * Kartları yazar. Toplu yazımda tek bir yinelenen anahtar bütün paketi
 * düşürdüğü için 23505 alınırsa satır satır yeniden denenir.
 */
async function insertCards(adminClient: DataClient, rows: CardInsert[]): Promise<number> {
  if (rows.length === 0) return 0

  const { data, error } = await adminClient.from('flashcards').insert(rows).select('id')
  if (!error) return (data ?? []).length

  if ((error as { code?: string }).code !== '23505') {
    throw new Error(`Kartlar yazılamadı: ${error.message}`)
  }

  let created = 0
  for (const row of rows) {
    const { error: rowError } = await adminClient.from('flashcards').insert(row)
    if (!rowError) {
      created += 1
      continue
    }
    // 23505 = kart bu arada başka bir çağrıda açıldı; beklenen sonuç, yutulur.
    if ((rowError as { code?: string }).code !== '23505') {
      console.error('[cards] kart yazılamadı:', rowError)
    }
  }
  return created
}
