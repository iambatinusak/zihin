import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
import { AppError } from '@/lib/errors'
import { getVideoById, getVideosForTopic } from './video'

/**
 * `/video/[id]` sayfasının çevresel verisi: kırıntı yolu için müfredat
 * zinciri, "Kazanımlar" sekmesi için `outcomes`, "Hafıza Notu" için konunun
 * kendisi ve aynı konudaki diğer videolar.
 *
 * Oynatmanın verisi (imzalı bağlantı, ilerleme, notlar, checkpoint'ler)
 * `lib/data/video.ts` ve video action'larındadır; burası yalnızca sayfanın
 * çerçevesini kurar. `lib/data/index.ts` paylaşılan bir dosya olduğu için
 * buradan yeniden dışa aktarılmadı; `@/lib/data/video-page` ile içe aktarılır.
 */

type Client = DataClient

export type VideoPageData = {
  video: Tables<'videos'>
  topic: Tables<'topics'>
  unit: Tables<'units'>
  subject: Tables<'subjects'>
  outcomes: Tables<'outcomes'>[]
  /** Aynı konunun yayımlanmış videoları (izlenen video da listede kalır). */
  siblingVideos: Tables<'videos'>[]
}

/** Konunun kazanımları, sıra numarasına göre. */
export async function getOutcomesForTopic(
  client: Client,
  topicId: string,
): Promise<Tables<'outcomes'>[]> {
  const { data, error } = await client
    .from('outcomes')
    .select('*')
    .eq('topic_id', topicId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Kazanımlar yüklenemedi.')
  return data ?? []
}

/**
 * Sayfanın tek okuması. İç içe select yerine düz sorgular: üretilen tipler
 * ilişki taşımıyor (CONVENTIONS §5, `lib/data` kuralı).
 */
export async function getVideoPageData(client: Client, videoId: string): Promise<VideoPageData> {
  const video = await getVideoById(client, videoId)

  const { data: topic, error: topicError } = await client
    .from('topics')
    .select('*')
    .eq('id', video.topic_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (topicError) throw new AppError('internal', 'Konu yüklenemedi.')
  if (!topic) throw new AppError('not_found', 'Videonun konusu bulunamadı.')

  const { data: unit, error: unitError } = await client
    .from('units')
    .select('*')
    .eq('id', topic.unit_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (unitError) throw new AppError('internal', 'Ünite yüklenemedi.')
  if (!unit) throw new AppError('not_found', 'Videonun ünitesi bulunamadı.')

  const { data: subject, error: subjectError } = await client
    .from('subjects')
    .select('*')
    .eq('id', unit.subject_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (subjectError) throw new AppError('internal', 'Ders yüklenemedi.')
  if (!subject) throw new AppError('not_found', 'Videonun dersi bulunamadı.')

  const [outcomes, siblingVideos] = await Promise.all([
    getOutcomesForTopic(client, topic.id),
    getVideosForTopic(client, topic.id),
  ])

  return { video, topic, unit, subject, outcomes, siblingVideos }
}
