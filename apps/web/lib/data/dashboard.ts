import 'server-only'

import { AppError } from '@/lib/errors'
import { lastDayKeys, longDayLabel, weekdayLabel } from '@/lib/activity/day'
import type { DataClient } from './client'

/**
 * Öğrenci panelinin (spec §9.3) okuma katmanı.
 *
 * Panelin her kutusu ayrı bir kaynaktan besleniyor; buradaki fonksiyonlar
 * yalnızca BAŞKA bir modülde karşılığı olmayanları kapsar. Yetkinlik
 * `lib/data/mastery.ts`, kart kuyruğu `lib/data/cards.ts`, program
 * `lib/data/plan.ts` dosyalarından okunur — burada kopyalanmaz.
 *
 * Sorgular normal oturum istemcisiyle çalışır: `daily_activity` ve
 * `test_sessions` kullanıcının kendi satırlarına RLS ile okuma izni verir.
 */

type Client = DataClient

export type DailyActivityPoint = {
  /** ISO gün (YYYY-MM-DD), Türkiye saatine göre. */
  date: string
  /** Grafik ekseni için kısa etiket: Pzt, Sal ... */
  shortLabel: string
  /** Erişilebilir metin için uzun etiket: 9 Eylül. */
  longLabel: string
  studySeconds: number
  /** Dakikaya yuvarlanmış hâli; grafik ve tablo bunu gösterir. */
  studyMinutes: number
  questionsAnswered: number
  cardsReviewed: number
}

/**
 * Son `days` günün çalışma özeti (varsayılan 7).
 *
 * Kayıt bulunmayan gün listeden DÜŞMEZ, sıfır değerle döner: grafikteki boş
 * sütun "o gün çalışılmadı" bilgisidir ve atlanırsa hafta yanlış okunur.
 */
export async function getWeeklyActivity(
  client: Client,
  userId: string,
  now: Date = new Date(),
  days = 7,
): Promise<DailyActivityPoint[]> {
  const keys = lastDayKeys(now, days)
  if (keys.length === 0) return []

  const first = keys[0]
  const last = keys[keys.length - 1]
  if (first === undefined || last === undefined) return []

  const { data, error } = await client
    .from('daily_activity')
    .select('date, study_seconds, questions_answered, cards_reviewed')
    .eq('user_id', userId)
    .gte('date', first)
    .lte('date', last)

  if (error) throw new AppError('internal', 'Çalışma özeti yüklenemedi.')

  const byDate = new Map((data ?? []).map((row) => [row.date, row]))

  return keys.map((date) => {
    const row = byDate.get(date)
    const studySeconds = row?.study_seconds ?? 0
    return {
      date,
      shortLabel: weekdayLabel(date),
      longLabel: longDayLabel(date),
      studySeconds,
      studyMinutes: Math.round(studySeconds / 60),
      questionsAnswered: row?.questions_answered ?? 0,
      cardsReviewed: row?.cards_reviewed ?? 0,
    }
  })
}

export type LastMockResult = {
  sessionId: string
  testTitle: string
  finishedAt: string
  /** Oturum özetindeki net; hesaplanamadıysa null. */
  net: number | null
  correct: number | null
  wrong: number | null
  blank: number | null
  /** En az 20 katılımcı yoksa null (spec §M10). */
  percentile: number | null
}

/**
 * Bitmiş son deneme sınavı.
 *
 * Denemeler Faz 5'e ait; bu fonksiyon veri yokken `null` döner ve panel
 * tasarlanmış bir boş durum gösterir. Sorgu iki adımdır çünkü üretilen tipler
 * ilişki taşımıyor: önce kullanıcının son biten oturumları, sonra o
 * oturumların testlerinden `mock_exam` olanı.
 */
export async function getLastMockResult(
  client: Client,
  userId: string,
  scanLimit = 20,
): Promise<LastMockResult | null> {
  const { data: sessionRows, error } = await client
    .from('test_sessions')
    .select('id, test_id, finished_at, summary, percentile')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(scanLimit)

  if (error) throw new AppError('internal', 'Deneme sonucu yüklenemedi.')

  const sessions = sessionRows ?? []
  if (sessions.length === 0) return null

  const { data: testRows, error: testError } = await client
    .from('tests')
    .select('id, type, title')
    .in('id', [...new Set(sessions.map((row) => row.test_id))])
    .eq('type', 'mock_exam')

  if (testError) throw new AppError('internal', 'Deneme sonucu yüklenemedi.')

  const mockTests = new Map((testRows ?? []).map((row) => [row.id, row]))
  const session = sessions.find((row) => mockTests.has(row.test_id))
  if (!session || session.finished_at === null) return null

  const summary = readSummary(session.summary)

  return {
    sessionId: session.id,
    testTitle: mockTests.get(session.test_id)?.title ?? '',
    finishedAt: session.finished_at,
    net: summary.net,
    correct: summary.correct,
    wrong: summary.wrong,
    blank: summary.blank,
    percentile: session.percentile === null ? null : Number(session.percentile),
  }
}

/**
 * `test_sessions.summary` serbest bir jsonb; şema onu doğrulamıyor. Bu yüzden
 * her alan tek tek ve savunmacı biçimde okunur — eski ya da eksik bir özet
 * paneli çökertmemeli.
 */
function readSummary(value: unknown): {
  net: number | null
  correct: number | null
  wrong: number | null
  blank: number | null
} {
  if (typeof value !== 'object' || value === null) {
    return { net: null, correct: null, wrong: null, blank: null }
  }
  const record = value as Record<string, unknown>
  return {
    net: numberOrNull(record.net),
    correct: numberOrNull(record.correct),
    wrong: numberOrNull(record.wrong),
    blank: numberOrNull(record.blank),
  }
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

/**
 * Konu kimliklerini `/dersler/<ders>/<ünite>/<konu>` yollarına çevirir.
 *
 * `rankPriorityTopics` core'un `TopicLike` tipini döner ve o tipte slug yok
 * (core müfredat URL'lerini tanımaz, tanımamalı). Bağlantıyı kurmak için üç
 * küçük düz sorgu yeterli; listede en fazla birkaç konu olur.
 */
export async function resolveTopicHrefs(
  client: Client,
  topicIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(topicIds)]
  const hrefs = new Map<string, string>()
  if (ids.length === 0) return hrefs

  const { data: topicRows, error: topicError } = await client
    .from('topics')
    .select('id, slug, unit_id')
    .in('id', ids)

  if (topicError) throw new AppError('internal', 'Konu bağlantıları çözülemedi.')
  const topics = topicRows ?? []
  if (topics.length === 0) return hrefs

  const { data: unitRows, error: unitError } = await client
    .from('units')
    .select('id, slug, subject_id')
    .in('id', [...new Set(topics.map((topic) => topic.unit_id))])

  if (unitError) throw new AppError('internal', 'Konu bağlantıları çözülemedi.')
  const units = new Map((unitRows ?? []).map((unit) => [unit.id, unit]))

  const { data: subjectRows, error: subjectError } = await client
    .from('subjects')
    .select('id, slug')
    .in('id', [...new Set([...units.values()].map((unit) => unit.subject_id))])

  if (subjectError) throw new AppError('internal', 'Konu bağlantıları çözülemedi.')
  const subjects = new Map((subjectRows ?? []).map((subject) => [subject.id, subject.slug]))

  for (const topic of topics) {
    const unit = units.get(topic.unit_id)
    const subjectSlug = unit ? subjects.get(unit.subject_id) : undefined
    if (!unit || subjectSlug === undefined) continue
    hrefs.set(topic.id, `/dersler/${subjectSlug}/${unit.slug}/${topic.slug}`)
  }

  return hrefs
}
