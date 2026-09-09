import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
import { AppError } from '@/lib/errors'

/**
 * Video izleme akışının veri erişimi.
 *
 * `lib/data/index.ts` paylaşılan bir dosya olduğu için buradan yeniden dışa
 * aktarılmadı; `@/lib/data/video` ile doğrudan içe aktarılır.
 *
 * Sorular DAİMA `questions_public` görünümünden okunur: `questions` tablosunun
 * `correct_option` ve `explanation` kolonları `authenticated` rolünden geri
 * alınmıştır, doğrudan select çalışma anında hata verir.
 */

type Client = DataClient

export type Video = Tables<'videos'>
export type VideoProgress = Tables<'video_progress'>
export type VideoNote = Tables<'video_notes'>
export type VideoCheckpointRow = Tables<'video_checkpoints'>

/** Checkpoint sorusunun istemciye giden hâli — doğru cevap ve açıklama YOKTUR. */
export type CheckpointQuestion = {
  id: string
  topicId: string
  type: string
  stem: string
  options: unknown
  imageUrl: string | null
  difficulty: number
  expectedSeconds: number
}

/** Video zaman çizgisindeki tek durak: konum + sorusu. */
export type VideoCheckpoint = {
  id: string
  videoId: string
  timestampSeconds: number
  orderIndex: number
  question: CheckpointQuestion
}

/** Videonun müfredat bağlamı; ödeme duvarı sınav kimliğine bakar. */
export type VideoContext = {
  video: Video
  topicId: string
  unitId: string
  subjectId: string
  examId: string
}

/** Tek video. Yayımlanmamış ya da silinmiş videolar yok sayılır. */
export async function getVideoById(client: Client, videoId: string): Promise<Video> {
  const { data, error } = await client
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Video yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız video bulunamadı.')
  return data
}

/** Bir konunun yayımlanmış videoları, sıra numarasına göre. */
export async function getVideosForTopic(client: Client, topicId: string): Promise<Video[]> {
  const { data, error } = await client
    .from('videos')
    .select('*')
    .eq('topic_id', topicId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Videolar yüklenemedi.')
  return data ?? []
}

/**
 * Videonun ait olduğu sınava kadar tüm müfredat zinciri.
 * İç içe select yerine üç düz sorgu: üretilen tipler ilişki taşımıyor.
 */
export async function getVideoContext(client: Client, videoId: string): Promise<VideoContext> {
  const video = await getVideoById(client, videoId)

  const { data: topic, error: topicError } = await client
    .from('topics')
    .select('id, unit_id')
    .eq('id', video.topic_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (topicError) throw new AppError('internal', 'Konu yüklenemedi.')
  if (!topic) throw new AppError('not_found', 'Videonun konusu bulunamadı.')

  const { data: unit, error: unitError } = await client
    .from('units')
    .select('id, subject_id')
    .eq('id', topic.unit_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (unitError) throw new AppError('internal', 'Ünite yüklenemedi.')
  if (!unit) throw new AppError('not_found', 'Videonun ünitesi bulunamadı.')

  const { data: subject, error: subjectError } = await client
    .from('subjects')
    .select('id, exam_id')
    .eq('id', unit.subject_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (subjectError) throw new AppError('internal', 'Ders yüklenemedi.')
  if (!subject) throw new AppError('not_found', 'Videonun dersi bulunamadı.')

  return {
    video,
    topicId: topic.id,
    unitId: unit.id,
    subjectId: subject.id,
    examId: subject.exam_id,
  }
}

/**
 * Videonun checkpoint'leri, soruları eklenmiş hâlde.
 *
 * İki düz sorgu (checkpoint'ler, sonra `questions_public`) ve JS tarafında
 * birleştirme. Sorusu yayımdan kaldırılmış checkpoint listeden düşer;
 * cevaplanamayacak bir duraklama oynatıcıyı kilitler.
 */
export async function getCheckpointsForVideo(
  client: Client,
  videoId: string,
): Promise<VideoCheckpoint[]> {
  const { data: rows, error } = await client
    .from('video_checkpoints')
    .select('*')
    .eq('video_id', videoId)
    .is('deleted_at', null)
    .order('timestamp_seconds', { ascending: true })

  if (error) throw new AppError('internal', 'Video durakları yüklenemedi.')
  const checkpoints = rows ?? []
  if (checkpoints.length === 0) return []

  const { data: questionRows, error: questionError } = await client
    .from('questions_public')
    .select('id, topic_id, type, stem, options, image_url, difficulty, expected_seconds')
    .in(
      'id',
      checkpoints.map((checkpoint) => checkpoint.question_id),
    )
    .eq('is_published', true)

  if (questionError) throw new AppError('internal', 'Durak soruları yüklenemedi.')

  const questionById = new Map<string, CheckpointQuestion>()
  for (const row of questionRows ?? []) {
    if (!row.id) continue
    questionById.set(row.id, {
      id: row.id,
      topicId: row.topic_id ?? '',
      type: row.type ?? 'multiple_choice',
      stem: row.stem ?? '',
      options: row.options,
      imageUrl: row.image_url ?? null,
      difficulty: row.difficulty ?? 3,
      expectedSeconds: row.expected_seconds ?? 60,
    })
  }

  return checkpoints.flatMap((checkpoint) => {
    const question = questionById.get(checkpoint.question_id)
    if (!question) return []
    return [
      {
        id: checkpoint.id,
        videoId: checkpoint.video_id,
        timestampSeconds: checkpoint.timestamp_seconds,
        orderIndex: checkpoint.order_index,
        question,
      },
    ]
  })
}

/** Kullanıcının bu videodaki ilerlemesi. Hiç izlememişse null. */
export async function getVideoProgress(
  client: Client,
  userId: string,
  videoId: string,
): Promise<VideoProgress | null> {
  const { data, error } = await client
    .from('video_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .maybeSingle()

  if (error) throw new AppError('internal', 'İzleme bilgisi yüklenemedi.')
  return data ?? null
}

/** Kullanıcının bu videoya aldığı notlar, videodaki konumlarına göre sıralı. */
export async function getNotesForVideo(
  client: Client,
  userId: string,
  videoId: string,
): Promise<VideoNote[]> {
  const { data, error } = await client
    .from('video_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .order('timestamp_seconds', { ascending: true })

  if (error) throw new AppError('internal', 'Notlar yüklenemedi.')
  return data ?? []
}

/** Tek bir checkpoint (yalnızca soru kimliğiyle birlikte; cevabı içermez). */
export async function getCheckpointById(
  client: Client,
  checkpointId: string,
): Promise<VideoCheckpointRow> {
  const { data, error } = await client
    .from('video_checkpoints')
    .select('*')
    .eq('id', checkpointId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Video durağı yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız video durağı bulunamadı.')
  return data
}
