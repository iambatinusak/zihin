import type { MasteryMap } from '@/lib/data/mastery'

/**
 * Panel'in saf yardımcıları. Supabase ya da React tanımaz, bu yüzden
 * doğrudan test edilir (uygulama Docker olmadan koşamıyor; mantık burada
 * sınanır, bkz. CONVENTIONS §9).
 */

export type TopicIndexEntry = {
  topicSlug: string
  attemptsCount: number
  subjectName: string
  subjectSlug: string
  unitId: string
  unitName: string
}

/** Yetkinlik haritasını konu kimliğinden aranabilir düz bir dizine çevirir. */
export function buildTopicIndex(map: MasteryMap): Map<string, TopicIndexEntry> {
  const index = new Map<string, TopicIndexEntry>()

  for (const subject of map.subjects) {
    for (const unit of subject.units) {
      for (const topic of unit.topics) {
        index.set(topic.topicId, {
          topicSlug: topic.slug,
          attemptsCount: topic.attemptsCount,
          subjectName: subject.name,
          subjectSlug: subject.slug,
          unitId: unit.unitId,
          unitName: unit.name,
        })
      }
    }
  }
  return index
}

/**
 * Konu sayfasının yolu. Üç slug'dan biri eksikse bağlantı üretilmez —
 * kırık bir bağlantı vermektense düğmeyi gizlemek doğru davranış.
 */
export function topicHref(
  subjectSlug: string | null,
  unitSlug: string | null,
  topicSlug: string | null,
): string | null {
  if (!subjectSlug || !unitSlug || !topicSlug) return null
  return `/dersler/${subjectSlug}/${unitSlug}/${topicSlug}`
}

/** Hafıza kartları ekranının konuya filtrelenmiş hâli. */
export function cardsHref(topicId: string): string {
  return `/kartlar?topic=${encodeURIComponent(topicId)}`
}

/**
 * Konu başına ilk videoyu seçer. Sorgu `order_index` artan sırada geldiği
 * için ilk görülen kazanır; yine de sıralamaya güvenmeyip küçüğü seçer,
 * böylece sorgu sırası değişse de sonuç aynı kalır.
 */
export function pickFirstVideoIds(
  rows: readonly { id: string; topic_id: string; order_index: number }[],
): Map<string, string> {
  const best = new Map<string, { id: string; orderIndex: number }>()

  for (const row of rows) {
    const current = best.get(row.topic_id)
    if (!current || row.order_index < current.orderIndex) {
      best.set(row.topic_id, { id: row.id, orderIndex: row.order_index })
    }
  }

  return new Map([...best].map(([topicId, video]) => [topicId, video.id]))
}
