/**
 * `mastery_history` satırlarının haftalık ortalamaya indirgenmesi.
 *
 * Saf fonksiyonlar: "şu an" bilgisi parametre olarak gelir, `Date.now()`
 * çağrılmaz — grafik testleri tekrarlanabilir kalsın diye.
 */

import { DAY_MS, turkeyWeekStartKey } from '@/lib/time/turkey'

export type MasteryHistoryPoint = {
  mastery: number
  recordedAt: string | Date
}

export type MasteryTimelinePoint = {
  /** Haftanın pazartesisi, ISO tarih (YYYY-MM-DD), Türkiye saatine göre. */
  weekStart: string
  /** O haftaya düşen kayıtların ortalaması (0-100, tam sayı). */
  averageMastery: number
  /** Ortalamaya giren kayıt sayısı. */
  sampleCount: number
}

/**
 * Bir anın ait olduğu haftanın pazartesisi (ISO-8601, Türkiye saati).
 * Kural `lib/time/turkey.ts` içinde; burada yalnızca grafiğin beklediği
 * `string | Date` imzasıyla yeniden dışa vurulur.
 */
export function weekStartKey(value: string | Date): string {
  return turkeyWeekStartKey(value)
}

/**
 * Kayıtları haftalara böler ve her hafta için ortalama yetkinliği döner.
 * Sonuç eskiden yeniye sıralıdır; veri olmayan haftalar üretilmez (grafik
 * boşluğu, uydurulmuş bir 0'dan dürüsttür).
 */
export function toWeeklyAverages(points: MasteryHistoryPoint[]): MasteryTimelinePoint[] {
  const buckets = new Map<string, { total: number; count: number }>()

  for (const point of points) {
    const key = weekStartKey(point.recordedAt)
    if (key === '') continue
    const bucket = buckets.get(key) ?? { total: 0, count: 0 }
    bucket.total += point.mastery
    bucket.count += 1
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([weekStart, bucket]) => ({
      weekStart,
      averageMastery: Math.round(bucket.total / bucket.count),
      sampleCount: bucket.count,
    }))
}

/** `weeks` hafta öncesinin başlangıç anı — sorguya `recorded_at >= ...` olarak gider. */
export function timelineSince(now: Date, weeks: number): Date {
  const safeWeeks = Number.isFinite(weeks) && weeks > 0 ? Math.floor(weeks) : 1
  return new Date(now.getTime() - safeWeeks * 7 * DAY_MS)
}
