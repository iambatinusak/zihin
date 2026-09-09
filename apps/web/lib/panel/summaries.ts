import type { MasteryStatus } from '@zihin/core'
import type { MasteryMap, MasteryTopicEntry, SubjectAverage } from '@/lib/data/mastery'
import type { MasteryTimelinePoint } from '@/lib/mastery/timeline'
import { fill } from '@/lib/i18n'

/**
 * Grafiklerin metin karşılıkları ve ısı haritası sayımları.
 *
 * Grafik tek başına ekran okuyucuya hiçbir şey anlatmaz; her grafiğin yanında
 * aynı veriyi taşıyan bir cümle ve bir tablo bulunur. O cümleyi üreten
 * fonksiyonlar burada, saf olarak durur.
 */

export const MASTERY_STATUSES: readonly MasteryStatus[] = [
  'strong',
  'medium',
  'weak',
  'unknown',
] as const

/** Isı haritası renk anahtarındaki sayılar. */
export function countByStatus(map: MasteryMap): Record<MasteryStatus, number> {
  const counts: Record<MasteryStatus, number> = { unknown: 0, weak: 0, medium: 0, strong: 0 }
  for (const subject of map.subjects) {
    for (const unit of subject.units) {
      for (const topic of unit.topics) counts[topic.status] += 1
    }
  }
  return counts
}

/** Bir dersin tüm konuları (ünite sırası korunarak) — ısı haritası ızgarası için. */
export function flattenTopics(units: MasteryMap['subjects'][number]['units']): MasteryTopicEntry[] {
  return units.flatMap((unit) => unit.topics)
}

/**
 * Radar için ders ortalamaları. `getSubjectAverages` aynı sonucu üretir ama
 * içeride haritayı BİR KEZ DAHA okur; panel haritayı zaten elinde tuttuğu için
 * türetme burada saf olarak yapılır (mastery ajanının uyarısı).
 */
export function subjectAveragesFromMap(map: MasteryMap): SubjectAverage[] {
  return map.subjects.map((subject) => ({
    subjectId: subject.subjectId,
    name: subject.name,
    color: subject.color,
    orderIndex: subject.orderIndex,
    averageMastery: subject.averageMastery,
    topicCount: subject.topicCount,
    measuredTopicCount: subject.units.reduce(
      (sum, unit) => sum + unit.topics.filter((topic) => topic.status !== 'unknown').length,
      0,
    ),
  }))
}

export type TrendSummaryInput = {
  points: readonly MasteryTimelinePoint[]
  /** `{weeks} {first} {last}` yer tutuculu şablon. */
  template: string
  /** Tek nokta varken kullanılan `{last}` yer tutuculu şablon. */
  singleTemplate: string
}

/** Zaman serisinin bir cümlelik özeti. Nokta yoksa null. */
export function trendSummary({
  points,
  template,
  singleTemplate,
}: TrendSummaryInput): string | null {
  if (points.length === 0) return null

  const last = points[points.length - 1]
  if (!last) return null
  if (points.length === 1) return fill(singleTemplate, { last: last.averageMastery })

  const first = points[0]
  if (!first) return null

  return fill(template, {
    weeks: points.length,
    first: first.averageMastery,
    last: last.averageMastery,
  })
}

export type RadarExtremes = {
  best: SubjectAverage
  worst: SubjectAverage
}

/**
 * Radar grafiğinin en güçlü / en zayıf dersi. Tek ders varsa ikisi de aynıdır;
 * hiç ders yoksa null döner ve çağıran cümleyi hiç yazmaz.
 */
export function radarExtremes(subjects: readonly SubjectAverage[]): RadarExtremes | null {
  if (subjects.length === 0) return null

  let best = subjects[0]
  let worst = subjects[0]
  if (!best || !worst) return null

  for (const subject of subjects) {
    if (subject.averageMastery > best.averageMastery) best = subject
    if (subject.averageMastery < worst.averageMastery) worst = subject
  }
  return { best, worst }
}

/** `2026-01-05` → `05.01` — grafik ekseninde yer kaplamayan kısa etiket. */
export function shortWeekLabel(weekStart: string): string {
  const parts = weekStart.split('-')
  const month = parts[1]
  const day = parts[2]
  if (!month || !day) return weekStart
  return `${day}.${month}`
}
