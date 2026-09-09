import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
import { AppError } from '@/lib/errors'
import type { ParticipantNet } from '@/lib/mock/percentile'

/**
 * Deneme sınavlarının okuma katmanı (spec §M10).
 *
 * GÜVENLİK KURALI (data/test.ts ile aynı): burada `public.questions` OKUNMAZ.
 * Soru gösterimi `getTestQuestions` üzerinden `questions_public` görünümünden
 * gelir; cevap anahtarı yalnızca service-role istemcisiyle ve yalnızca bitmiş
 * bir oturum için açılır.
 *
 * Sorgular DÜZDÜR (iç içe select yok): üretilen tipler ilişki taşımıyor
 * (CONVENTIONS §5).
 */

type Client = DataClient

export type MockRow = Tables<'tests'>

/** Bir denemenin soru bağı — bölüm bilgisi burada yaşar. */
export type MockQuestionLink = {
  testId: string
  questionId: string
  orderIndex: number
  section: string | null
}

/**
 * Kullanıcının hedef sınavına ait yayımlanmış denemeler.
 *
 * `publish_at` GELECEKTEYSE deneme listelenmez: yayın zamanı gelmemiş bir
 * içeriğin başlığı bile sızmamalı. Canlı pencere ayrı bir kavramdır — pencere
 * açılmadan önce deneme LİSTELENİR (öğrenci hazırlansın) ama başlatılamaz.
 */
export async function getPublishedMocks(client: Client, examId: string): Promise<MockRow[]> {
  const { data, error } = await client
    .from('tests')
    .select('*')
    .eq('type', 'mock_exam')
    .eq('exam_id', examId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new AppError('internal', 'Denemeler yüklenemedi.')

  const now = Date.now()
  return (data ?? []).filter((row) => {
    if (row.publish_at === null) return true
    const publishAt = Date.parse(row.publish_at)
    return Number.isNaN(publishAt) || publishAt <= now
  })
}

/**
 * Verilen denemelerin soru bağları, deneme kimliğine göre gruplanmış.
 *
 * Listeleme ekranı soru sayısını ve ders dağılımını buradan çıkarır; soru
 * metinlerini çekmeye gerek yok (bir listede yüzlerce soru gövdesi indirmek
 * ölçeklenmez).
 */
export async function getMockQuestionLinks(
  client: Client,
  testIds: readonly string[],
): Promise<Map<string, MockQuestionLink[]>> {
  const unique = [...new Set(testIds)].filter(Boolean)
  const grouped = new Map<string, MockQuestionLink[]>()
  if (unique.length === 0) return grouped

  const { data, error } = await client
    .from('test_questions')
    .select('test_id, question_id, order_index, section')
    .in('test_id', unique)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Deneme soruları yüklenemedi.')

  for (const row of data ?? []) {
    const list = grouped.get(row.test_id) ?? []
    list.push({
      testId: row.test_id,
      questionId: row.question_id,
      orderIndex: row.order_index,
      section: row.section,
    })
    grouped.set(row.test_id, list)
  }
  return grouped
}

export type MockSessionRow = {
  id: string
  testId: string
  startedAt: string
  finishedAt: string | null
  expiresAt: string
  summary: unknown
  percentile: number | null
}

/** Kullanıcının bu denemelerdeki oturumları, deneme kimliğine göre gruplanmış. */
export async function getUserSessionsForTests(
  client: Client,
  userId: string,
  testIds: readonly string[],
): Promise<Map<string, MockSessionRow[]>> {
  const unique = [...new Set(testIds)].filter(Boolean)
  const grouped = new Map<string, MockSessionRow[]>()
  if (unique.length === 0) return grouped

  const { data, error } = await client
    .from('test_sessions')
    .select('id, test_id, started_at, finished_at, expires_at, summary, percentile')
    .eq('user_id', userId)
    .in('test_id', unique)
    .order('started_at', { ascending: false })

  if (error) throw new AppError('internal', 'Deneme oturumları yüklenemedi.')

  for (const row of data ?? []) {
    const list = grouped.get(row.test_id) ?? []
    list.push({
      id: row.id,
      testId: row.test_id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      expiresAt: row.expires_at,
      summary: row.summary,
      percentile: row.percentile === null ? null : Number(row.percentile),
    })
    grouped.set(row.test_id, list)
  }
  return grouped
}

/**
 * Bu denemeyi BİTİRMİŞ tüm katılımcıların netleri.
 *
 * SERVICE-ROLE İSTEMCİSİ İSTER: bir öğrenci başkalarının oturumlarını okuyamaz
 * (RLS) ve okuyabilmesi de doğru olmazdı.
 *
 * KULLANICI KİMLİĞİ DE OKUNUR ve bu bilinçlidir. Deneme YENİDEN çözülebiliyor
 * (`mock-card.tsx` bitmiş bir denemede "tekrar çöz" sunar), dolayısıyla tek bir
 * öğrencinin aynı denemede birden çok bitmiş oturumu olabilir. Kimlik olmadan
 * bu oturumlar dağılıma AYRI KATILIMCI olarak girer: 20 kişilik eşik sahte
 * satırlarla dolar ve çok çözen öğrenci kendi netleriyle yarışır. Kimlik
 * `buildNetPopulation` içinde katılımcı başına tek nete indirgemek için
 * kullanılır ve ORADAN DIŞARI ÇIKMAZ — çağıran taraf kimin kaç net yaptığını
 * yine göremez.
 *
 * `summary` serbest bir jsonb; her satır savunmacı okunur. Net alanı okunamayan
 * satır dağılıma girmez — sahte bir 0, dilimi aşağı çeker ve öğrenciye olduğundan
 * iyi bir sıralama gösterirdi.
 */
export async function getFinishedMockNets(
  adminClient: Client,
  testId: string,
  limit = 5000,
): Promise<ParticipantNet[]> {
  const { data, error } = await adminClient
    .from('test_sessions')
    .select('id, user_id, summary')
    .eq('test_id', testId)
    .not('finished_at', 'is', null)
    .limit(limit)

  if (error) throw new AppError('internal', 'Yüzdelik dilim hesaplanamadı.')

  const nets: ParticipantNet[] = []
  for (const row of data ?? []) {
    const net = readNet(row.summary)
    if (net === null) continue
    nets.push({ sessionId: row.id, userId: row.user_id, net })
  }
  return nets
}

/**
 * Hesaplanan dilimi oturuma yazar (spec §M10: sonuç `test_sessions.percentile`
 * üzerinde tutulur, böylece panel ve veli raporu yeniden hesaplamaz).
 *
 * SERVICE-ROLE İSTEMCİSİ İSTER: dilim kullanıcının yazabileceği bir alan değil.
 * `user_id` filtresi RLS kapalıyken de yanlış satıra yazmayı engellemek için
 * burada tekrar yazılır (CONVENTIONS §4).
 */
export async function setSessionPercentile(
  adminClient: Client,
  input: { sessionId: string; userId: string; percentile: number },
): Promise<void> {
  const { error } = await adminClient
    .from('test_sessions')
    .update({ percentile: input.percentile })
    .eq('id', input.sessionId)
    .eq('user_id', input.userId)

  if (error) throw new AppError('internal', 'Yüzdelik dilim kaydedilemedi.')
}

/**
 * `test_sessions.summary` içinden neti okur.
 *
 * Şema jsonb'yi doğrulamıyor: eski, eksik ya da başka bir motor tarafından
 * yazılmış bir özet buraya düşebilir. Okunamayan her şey `null` döner ve
 * çağıran tarafta elenir.
 */
export function readNet(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null
  const net = (value as Record<string, unknown>).net
  if (typeof net !== 'number' || !Number.isFinite(net)) return null
  return net
}

/** Özetten doğru/yanlış/boş sayılarını savunmacı biçimde okur. */
export function readCounts(value: unknown): {
  correct: number | null
  wrong: number | null
  blank: number | null
} {
  if (typeof value !== 'object' || value === null) {
    return { correct: null, wrong: null, blank: null }
  }
  const record = value as Record<string, unknown>
  const read = (key: string): number | null => {
    const raw = record[key]
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
  }
  return { correct: read('correct'), wrong: read('wrong'), blank: read('blank') }
}
