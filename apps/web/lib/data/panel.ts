import 'server-only'

import type { MasteryStatus, PriorityTopic } from '@zihin/core'
import { AppError } from '@/lib/errors'
import { buildTopicIndex, pickFirstVideoIds, topicHref } from '@/lib/panel/priority'
import type { DataClient } from './client'
import type { MasteryMap } from './mastery'

/**
 * Akıllı Test Paneli'ne özgü okuma.
 *
 * `getPriorityTopics` core'un sıralamasını döner ama yalnızca `TopicLike`
 * taşır — ekranda gereken ders adı, slug üçlüsü ve "ilk video" bilgisi yok.
 * Burada eksik parça tamamlanır: ders/konu bilgisi zaten elde olan yetkinlik
 * haritasından okunur (yeni sorgu açılmaz), yalnızca ünite slug'ları ve
 * videolar için iki düz sorgu yapılır.
 */

export type PriorityTopicRow = {
  topicId: string
  title: string
  subjectName: string
  mastery: number
  status: MasteryStatus
  attemptsCount: number
  /** Konu sayfasının yolu. Slug üçlüsü tamamlanamazsa null. */
  topicHref: string | null
  /** Konunun ilk yayımlanmış videosu. Yoksa null — düğme konu sayfasına düşer. */
  firstVideoId: string | null
}

/**
 * Öncelik sırasını ekranda gösterilebilir satırlara çevirir.
 * `map` çağıran tarafta zaten üretilmiş olmalı; iki kez okumamak için
 * parametre olarak alınır (bkz. `getSubjectAverages` ile aynı gerekçe).
 */
export async function getPriorityTopicRows(
  client: DataClient,
  priority: PriorityTopic[],
  map: MasteryMap,
): Promise<PriorityTopicRow[]> {
  if (priority.length === 0) return []

  const index = buildTopicIndex(map)
  const topicIds = priority.map((item) => item.topic.id)
  const unitIds = [...new Set(priority.map((item) => item.topic.unitId))]

  const [unitSlugs, videoIds] = await Promise.all([
    getUnitSlugs(client, unitIds),
    loadFirstVideoIds(client, topicIds),
  ])

  return priority.map((item) => {
    const found = index.get(item.topic.id)
    return {
      topicId: item.topic.id,
      title: item.topic.title,
      subjectName: found?.subjectName ?? '',
      mastery: item.mastery,
      status: item.status,
      attemptsCount: found?.attemptsCount ?? 0,
      topicHref: topicHref(
        found?.subjectSlug ?? null,
        unitSlugs.get(item.topic.unitId) ?? null,
        found?.topicSlug ?? null,
      ),
      firstVideoId: videoIds.get(item.topic.id) ?? null,
    }
  })
}

/** Ünite slug'ları — yetkinlik haritası ünite adını taşır ama slug'ını taşımaz. */
export async function getUnitSlugs(
  client: DataClient,
  unitIds: string[],
): Promise<Map<string, string>> {
  const slugs = new Map<string, string>()
  if (unitIds.length === 0) return slugs

  const { data, error } = await client.from('units').select('id, slug').in('id', unitIds)

  if (error) throw new AppError('internal', 'Üniteler yüklenemedi.')
  for (const row of data ?? []) slugs.set(row.id, row.slug)
  return slugs
}

/** Konu başına en düşük `order_index`'e sahip yayımlanmış video. */
async function loadFirstVideoIds(
  client: DataClient,
  topicIds: string[],
): Promise<Map<string, string>> {
  if (topicIds.length === 0) return new Map<string, string>()

  const { data, error } = await client
    .from('videos')
    .select('id, topic_id, order_index')
    .in('topic_id', topicIds)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Konu videoları yüklenemedi.')
  return pickFirstVideoIds(data ?? [])
}
