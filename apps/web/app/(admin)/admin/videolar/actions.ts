'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminVideo, getCheckpointTimestamps } from '@/lib/data/admin-media'
import { normaliseVideoSource } from '@/lib/media/video-source'
import { validateCheckpointTimestamp } from '@/lib/media/checkpoint'
import {
  AddCheckpointSchema,
  CreateVideoSchema,
  DeleteVideoSchema,
  RemoveCheckpointSchema,
  SetVideoPublishedSchema,
  UpdateVideoSchema,
} from './schemas'

/**
 * Video yönetimi ve zaman çubuğu durakları (spec §M15).
 *
 * ── YETKİ ──────────────────────────────────────────────────────────────────
 * Hepsi `assertRole(['editor', 'admin'])`. Video içerik tarafıdır; editörün
 * asıl işi budur. Denetim HER action'ın kendi içindedir: `(admin)` düzeninin
 * `requireRole`u yalnızca sayfayı korur, bir Server Action ise herkese açık bir
 * uç noktadır (CONVENTIONS §3). Bu projede daha önce üç kez, düzenin guard'ına
 * güvenilen bir action açıkta kaldı.
 *
 * ── İSTEMCİ ────────────────────────────────────────────────────────────────
 * Yazma için service-role DEĞİL, normal RSC/action istemcisi kullanılır:
 * `videos`, `video_checkpoints` ve `flashcards` üzerinde `is_editor()`
 * politikaları zaten yazma izni veriyor. RLS'i devre dışı bırakmak için bir
 * sebep yok — cevap kolonları (`correct_option`, `explanation`) bu akışta
 * hiç okunmuyor.
 */

const LIST_PATH = '/admin/videolar'

export type VideoMutationResult = { id: string }

export const createVideo = action(
  CreateVideoSchema,
  async (input): Promise<VideoMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const source = normaliseVideoSource(input)

    const { data, error } = await supabase
      .from('videos')
      .insert({
        topic_id: input.topicId,
        title: input.title,
        type: input.type,
        thumbnail_url: input.thumbnailUrl,
        duration_seconds: input.durationSeconds,
        order_index: input.orderIndex,
        is_free_preview: input.isFreePreview,
        is_published: input.isPublished,
        ...source,
      })
      .select('id')
      .single()

    if (error || !data) throw new AppError('internal', 'Video kaydedilemedi.')

    revalidatePath(LIST_PATH)
    return { id: data.id }
  },
)

export const updateVideo = action(
  UpdateVideoSchema,
  async (input): Promise<VideoMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const source = normaliseVideoSource(input)

    const { error } = await supabase
      .from('videos')
      .update({
        topic_id: input.topicId,
        title: input.title,
        type: input.type,
        thumbnail_url: input.thumbnailUrl,
        duration_seconds: input.durationSeconds,
        order_index: input.orderIndex,
        is_free_preview: input.isFreePreview,
        is_published: input.isPublished,
        ...source,
      })
      .eq('id', input.id)
      .is('deleted_at', null)

    if (error) throw new AppError('internal', 'Video güncellenemedi.')

    revalidatePath(LIST_PATH)
    revalidatePath(`${LIST_PATH}/${input.id}`)
    return { id: input.id }
  },
)

export const setVideoPublished = action(
  SetVideoPublishedSchema,
  async (input): Promise<VideoMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('videos')
      .update({ is_published: input.isPublished })
      .eq('id', input.id)
      .is('deleted_at', null)

    if (error) throw new AppError('internal', 'Yayın durumu değiştirilemedi.')

    revalidatePath(LIST_PATH)
    revalidatePath(`${LIST_PATH}/${input.id}`)
    return { id: input.id }
  },
)

/**
 * YUMUŞAK silme. İçerik tabloları hiçbir zaman fiziksel silinmez
 * (CONVENTIONS §6): silinen bir videoya bağlı izleme kaydı ve durak varlığını
 * sürdürür, kayıt geri alınabilir.
 */
export const deleteVideo = action(
  DeleteVideoSchema,
  async (input): Promise<VideoMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('videos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)
      .is('deleted_at', null)

    if (error) throw new AppError('internal', 'Video silinemedi.')

    revalidatePath(LIST_PATH)
    return { id: input.id }
  },
)

// ---------------------------------------------------------------------------
// Zaman çubuğu durakları
// ---------------------------------------------------------------------------

export type CheckpointMutationResult = { id: string; videoId: string }

/**
 * Videonun bir saniyesine soru iliştirir.
 *
 * İki denetim şemada değil BURADA yapılır, çünkü ikisi de veritabanı okumasına
 * dayanır: zamanın videonun süresi içinde olması ve o saniyenin boş olması
 * (`unique (video_id, timestamp_seconds)`). Kısıta ham hâliyle çarpmak yerine
 * önce okunup alan bazlı Türkçe hata üretilir; yarış durumunda kısıt yine
 * yakalar ve `conflict` koduna çevrilir.
 */
export const addCheckpoint = action(
  AddCheckpointSchema,
  async (input): Promise<CheckpointMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const video = await getAdminVideo(supabase, input.videoId)
    const existing = await getCheckpointTimestamps(supabase, input.videoId)

    const issue = validateCheckpointTimestamp({
      timestampSeconds: input.timestampSeconds,
      durationSeconds: video.duration_seconds,
      existingTimestamps: existing,
    })
    if (issue) {
      throw new AppError('validation', issue.message, { [issue.field]: [issue.message] })
    }

    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id')
      .eq('id', input.questionId)
      .is('deleted_at', null)
      .maybeSingle()

    if (questionError) throw new AppError('internal', 'Soru doğrulanamadı.')
    if (!question) {
      throw new AppError('not_found', 'Seçtiğiniz soru bulunamadı.', {
        questionId: ['Seçtiğiniz soru bulunamadı.'],
      })
    }

    // Sıra zamandan türetilir: iki durak aynı saniyede olamadığı için zaman
    // zaten benzersiz bir sıralama verir.
    const row = {
      video_id: input.videoId,
      question_id: input.questionId,
      timestamp_seconds: input.timestampSeconds,
      order_index: input.timestampSeconds,
    }

    // ARŞİVLENMİŞ SATIR DİRİLTİLİR. `unique (video_id, timestamp_seconds)`
    // kısıtı yumuşak silinmiş satırı da kapsar; yeni bir insert denenirse
    // editör aynı saniyeye bir daha ASLA durak koyamazdı. Bu yüzden önce o
    // saniyedeki arşiv satırı aranır ve varsa üzerine yazılır.
    const { data: archived, error: archivedError } = await supabase
      .from('video_checkpoints')
      .select('id')
      .eq('video_id', input.videoId)
      .eq('timestamp_seconds', input.timestampSeconds)
      .not('deleted_at', 'is', null)
      .maybeSingle()

    if (archivedError) throw new AppError('internal', 'Durak eklenemedi.')

    if (archived) {
      const { error: reviveError } = await supabase
        .from('video_checkpoints')
        .update({ ...row, deleted_at: null })
        .eq('id', archived.id)

      if (reviveError) throw new AppError('internal', 'Durak eklenemedi.')

      revalidatePath(`${LIST_PATH}/${input.videoId}`)
      return { id: archived.id, videoId: input.videoId }
    }

    const { data, error } = await supabase
      .from('video_checkpoints')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      // 23505 = unique_violation; iki editör aynı anda aynı saniyeye eklediyse.
      if (error.code === '23505') {
        const message = 'Bu videoda o saniyede zaten bir durak var.'
        throw new AppError('conflict', message, { timestampSeconds: [message] })
      }
      throw new AppError('internal', 'Durak eklenemedi.')
    }
    if (!data) throw new AppError('internal', 'Durak eklenemedi.')

    revalidatePath(`${LIST_PATH}/${input.videoId}`)
    return { id: data.id, videoId: input.videoId }
  },
)

export const removeCheckpoint = action(
  RemoveCheckpointSchema,
  async (input): Promise<CheckpointMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()

    // Yumuşak silme. Satır o saniyeyi tutmaya devam eder (unique kısıtı
    // arşivlenmiş satırı da kapsar); aynı saniyeye yeniden durak konursa
    // `addCheckpoint` bu satırı diriltir.
    const { data: row, error: readError } = await supabase
      .from('video_checkpoints')
      .select('video_id')
      .eq('id', input.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (readError) throw new AppError('internal', 'Durak okunamadı.')
    if (!row) throw new AppError('not_found', 'Aradığınız durak bulunamadı.')

    const { error } = await supabase
      .from('video_checkpoints')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)

    if (error) throw new AppError('internal', 'Durak kaldırılamadı.')

    revalidatePath(`${LIST_PATH}/${row.video_id}`)
    return { id: input.id, videoId: row.video_id }
  },
)
