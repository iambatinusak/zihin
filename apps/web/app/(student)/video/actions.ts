'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { levelForXp, XP_TABLE } from '@zihin/core'
import {
  getCheckpointById,
  getVideoContext,
  getVideoProgress,
  type VideoContext,
} from '@/lib/data/video'
import { recordStudyActivityQuietly } from '@/lib/activity/record'
import { evaluateAndAwardBadgesQuietly } from '@/lib/gamification/award'
import { recalculateQuietly } from '@/lib/mastery/recalculate'
import { hasSubscriptionAccess } from '@/lib/billing/access'
import { getVideoProvider } from '@/lib/video'
import { hasCrossedCompletionThreshold, nextProgress } from '@/lib/video/progress'
import {
  AddNoteSchema,
  AnswerCheckpointSchema,
  DeleteNoteSchema,
  SaveProgressSchema,
  UpdateNoteSchema,
  VideoIdSchema,
} from './schemas'

/**
 * Video izleme akışının mutasyonları.
 *
 * Yetki her action'ın kendi işidir: bir Server Action doğrudan çağrılabilir,
 * düzenin (layout) guard'ı onu korumaz (CONVENTIONS §3).
 */

/** İçeriği yönetenler ödeme duvarına takılmaz; oynatma onlara da açıktır. */
const VIEWER_ROLES = ['student', 'teacher', 'editor', 'admin'] as const

/**
 * Ödeme duvarı. İmzalamadan ÖNCE çalışır: bağlantı bir kez üretildiğinde
 * paylaşılabilir hâle gelir, sonradan yapılan denetim ürünü geri getirmez.
 *
 * Erişim iki yoldan biriyle açılır:
 *   1. video `is_free_preview` ise herkese,
 *   2. kullanıcının o sınavı kapsayan aktif aboneliği varsa.
 * Abonelik kararını veritabanındaki `public.has_active_subscription()` verir;
 * RLS ile aynı fonksiyon, böylece iki katman aynı cevabı üretir.
 */
async function assertVideoAccess(context: VideoContext): Promise<void> {
  if (context.video.is_free_preview) return

  // Kapının kendisi TEK yerde: `lib/billing/access.ts`. Burada yalnızca
  // videoya özel mesaj eklenir. RPC çağrısı bir zamanlar burada kopyalanmıştı;
  // iki kopyanın ayrışması abonelik kapısında sessiz bir açık demekti.
  if (await hasSubscriptionAccess(context.examId)) return

  throw new AppError(
    'subscription_required',
    'Bu videoyu izlemek için aktif bir aboneliğiniz olmalı.',
  )
}

/**
 * Oynatma bağlantısı üretir. Bağlantı 4 saat geçerlidir (spec §M3 BR).
 * Sağlayıcı videonun kendi `provider` kolonuna göre seçilir; ortam değişkeni
 * yalnızca varsayılanı belirler, tek tek videolar taşınabilsin diye.
 */
export const getSignedVideoUrl = action(VideoIdSchema, async (input) => {
  await assertRole([...VIEWER_ROLES])
  const supabase = await createSupabaseServerClient()

  const context = await getVideoContext(supabase, input.videoId)
  await assertVideoAccess(context)

  const provider = getVideoProvider(context.video.provider)
  const signed = await provider.getSignedUrl({
    id: context.video.id,
    provider: context.video.provider,
    storagePath: context.video.storage_path,
    providerVideoId: context.video.provider_video_id,
    thumbnailUrl: context.video.thumbnail_url,
  })

  return {
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
    provider: signed.provider,
    durationSeconds: context.video.duration_seconds,
  }
})

/**
 * İzleme konumunu ve süresini kaydeder. Oynatıcı bunu düzenli aralıklarla
 * çağırır; artış `nextProgress()` içinde kırpılır (bkz. lib/video/progress.ts).
 */
export const saveProgress = action(SaveProgressSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const context = await getVideoContext(supabase, input.videoId)
  await assertVideoAccess(context)

  const previous = await getVideoProgress(supabase, user.id, input.videoId)
  const next = nextProgress(
    previous && {
      lastPositionSeconds: previous.last_position_seconds,
      watchTimeSeconds: previous.watch_time_seconds,
      completedAt: previous.completed_at,
    },
    input,
    context.video.duration_seconds,
  )

  const { error } = await supabase.from('video_progress').upsert(
    {
      user_id: user.id,
      video_id: input.videoId,
      last_position_seconds: next.lastPositionSeconds,
      watch_time_seconds: next.watchTimeSeconds,
    },
    { onConflict: 'user_id,video_id' },
  )

  if (error) throw new AppError('internal', 'İzleme bilgisi kaydedilemedi.')

  /*
   * Video izlemek de çalışmaktır: serinin ilerlemesi için gereken günlük 15
   * dakika (spec §M13) yalnızca test ve karttan toplanırsa, sadece video
   * izleyen bir öğrencinin serisi hiç başlamaz.
   *
   * Süreyi istemcinin gönderdiği değerden değil, kaydedilen iki sayaç
   * arasındaki FARKTAN alıyoruz: `nextProgress` girdiyi zaten kırpıyor,
   * dolayısıyla buradaki fark da kırpılmış olur ve şişirilemez.
   */
  const watchedSeconds = Math.max(0, next.watchTimeSeconds - (previous?.watch_time_seconds ?? 0))
  if (watchedSeconds > 0) {
    await recordStudyActivityQuietly(createSupabaseAdminClient(), user.id, {
      seconds: watchedSeconds,
    })
  }

  return {
    lastPositionSeconds: next.lastPositionSeconds,
    watchTimeSeconds: next.watchTimeSeconds,
    completed: next.completedAt !== null,
    eligibleForCompletion: hasCrossedCompletionThreshold(next, context.video.duration_seconds),
  }
})

/**
 * Videoyu tamamlanmış işaretler ve puanı BİR KEZ verir
 * (spec §M3 AC: "Tamamlanma bir kez tetiklenir, puan bir kez verilir").
 *
 * ÜÇ koruma üst üste konur:
 *   - Eşik SUNUCUDA doğrulanır. Bu bir Server Action; istemci onu doğrudan
 *     çağırabilir. Eşiği yalnızca oynatıcının denetlemesi, videoyu hiç
 *     açmadan puan toplamak demekti. Karar `video_progress` satırından,
 *     yani `saveProgress` içinde zaten kırpılmış sayaçlardan verilir.
 *   - `completed_at` güncellemesi yalnızca değer null iken uygulanır; iki
 *     eşzamanlı çağrıdan yalnızca biri satır döner.
 *   - Puan kaydı `xp_events` üzerindeki kısmi tekil indekse (user_id, reason,
 *     ref_id) yaslanır; oku-sonra-yaz yarışı yerine yinelenen anahtar hatası
 *     yutulur.
 */
export const completeVideo = action(VideoIdSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const context = await getVideoContext(supabase, input.videoId)
  await assertVideoAccess(context)

  const previous = await getVideoProgress(supabase, user.id, input.videoId)

  // Zaten tamamlanmış: yeni bir şey yazılmaz, puan ikinci kez verilmez.
  if (previous?.completed_at) {
    return { completed: true, firstCompletion: false, awardedXp: 0 }
  }

  // Eşik denetimi. İlerleme satırı hiç yoksa izlenen süre de yoktur; kırpılmış
  // sayaçlar eşiği geçmeden tamamlanma kabul edilmez.
  const eligible = hasCrossedCompletionThreshold(
    {
      lastPositionSeconds: previous?.last_position_seconds ?? 0,
      watchTimeSeconds: previous?.watch_time_seconds ?? 0,
    },
    context.video.duration_seconds,
  )
  if (!eligible) {
    throw new AppError('forbidden', 'Video henüz tamamlanmış sayılmıyor.')
  }

  const completedAt = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('video_progress')
    .update({ completed_at: completedAt })
    .eq('user_id', user.id)
    .eq('video_id', input.videoId)
    .is('completed_at', null)
    .select('video_id')

  if (error) throw new AppError('internal', 'Video tamamlanamadı.')

  // Eşzamanlı ikinci çağrıda güncelleme boş döner: damgayı ilk çağrı attı,
  // puanı da o aldı.
  const firstCompletion = (updated ?? []).length > 0

  const awardedXp = firstCompletion ? await awardVideoXp(user.id, input.videoId) : 0

  // Gunluk "tamamlanan video" sayaci yalnizca ILK tamamlamada artar;
  // aksi halde ayni video tekrar tekrar bitirilerek sayac sisirilebilirdi.
  if (firstCompletion) {
    await recordStudyActivityQuietly(createSupabaseAdminClient(), user.id, {
      videos: 1,
      xp: awardedXp,
    })
    // Rozet bağlamı değişti (video sayısı, belki seri): değerlendirme sessiz.
    await evaluateAndAwardBadgesQuietly(createSupabaseAdminClient(), user.id)
  }

  revalidatePath('/dersler', 'layout')

  return { completed: true, firstCompletion, awardedXp }
})

/**
 * `video_completed` puanını yazar. Zaten yazılmışsa 0 döner.
 * `xp_events` RLS'te yalnızca service-role'a açıktır, bu yüzden admin istemci
 * kullanılır; parametreler doğrulanmış oturumdan gelir (CONVENTIONS §4).
 */
async function awardVideoXp(userId: string, videoId: string): Promise<number> {
  const amount = XP_TABLE.video_completed
  const admin = createSupabaseAdminClient()

  const { error } = await admin.from('xp_events').insert({
    user_id: userId,
    amount,
    reason: 'video_completed',
    ref_type: 'video',
    ref_id: videoId,
  })

  if (error) {
    // 23505 = tekil indeks ihlali: puan daha önce verilmiş. Beklenen sonuç,
    // yarışı okuma ile önlemeye çalışmak yerine indekse güvenilir.
    if ((error as { code?: string }).code === '23505') return 0
    console.error('[completeVideo] xp_events yazılamadı:', error)
    return 0
  }

  // profiles.xp denormalize bir toplamdır (bkz. 0002_identity.sql); tek gerçek
  // kaynak xp_events tablosudur, buradaki yazım yalnızca arayüzün okuduğu
  // anlık değeri tazeler.
  const { data: profile } = await admin.from('profiles').select('xp').eq('id', userId).maybeSingle()

  const total = (profile?.xp ?? 0) + amount
  await admin
    .from('profiles')
    .update({ xp: total, level: levelForXp(total).level })
    .eq('id', userId)

  return amount
}

/** Videonun belirli bir anına not ekler. */
export const addNote = action(AddNoteSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const context = await getVideoContext(supabase, input.videoId)
  await assertVideoAccess(context)

  const { data, error } = await supabase
    .from('video_notes')
    .insert({
      user_id: user.id,
      video_id: input.videoId,
      timestamp_seconds: Math.floor(input.timestampSeconds),
      body: input.body,
    })
    .select('*')
    .maybeSingle()

  if (error || !data) throw new AppError('internal', 'Not kaydedilemedi.')
  return data
})

/** Notu günceller. Sahiplik `user_id` filtresiyle ve RLS ile iki kez denetlenir. */
export const updateNote = action(UpdateNoteSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('video_notes')
    .update({ body: input.body })
    .eq('id', input.noteId)
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle()

  if (error) throw new AppError('internal', 'Not güncellenemedi.')
  if (!data) throw new AppError('not_found', 'Güncellenecek not bulunamadı.')
  return data
})

/** Notu siler. */
export const deleteNote = action(DeleteNoteSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('video_notes')
    .delete()
    .eq('id', input.noteId)
    .eq('user_id', user.id)
    .select('id')

  if (error) throw new AppError('internal', 'Not silinemedi.')
  if ((data ?? []).length === 0) throw new AppError('not_found', 'Silinecek not bulunamadı.')
  return { deleted: true }
})

/**
 * Checkpoint sorusunu SUNUCUDA değerlendirir.
 *
 * Doğru cevap ve açıklama yalnızca bu yanıtta, yalnızca cevap verildikten
 * sonra döner. `questions` tablosunun cevap kolonları `authenticated` rolünden
 * geri alınmıştır, bu yüzden okuma admin istemciyle yapılır (CONVENTIONS §4).
 *
 * Atlanan checkpoint için bu action hiç çağrılmaz: "atlanan = cevaplanmadı,
 * skora etki etmez" (spec §M4).
 */
export const answerCheckpoint = action(AnswerCheckpointSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const checkpoint = await getCheckpointById(supabase, input.checkpointId)
  const context = await getVideoContext(supabase, checkpoint.video_id)
  await assertVideoAccess(context)

  const admin = createSupabaseAdminClient()
  const { data: question, error: questionError } = await admin
    .from('questions')
    .select('id, topic_id, correct_option, explanation, is_published')
    .eq('id', checkpoint.question_id)
    .maybeSingle()

  if (questionError) throw new AppError('internal', 'Soru yüklenemedi.')
  if (!question || !question.is_published) {
    throw new AppError('not_found', 'Aradığınız soru bulunamadı.')
  }

  const isCorrect = input.selectedOption === question.correct_option

  // Aynı soru daha önce kaç kez çözüldüyse bu deneme bir sonraki tekrardır;
  // yetkinlik hesabı ilk denemeyi sonrakilerden ayırmak için buna bakar.
  const { count, error: countError } = await supabase
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('question_id', question.id)

  if (countError) throw new AppError('internal', 'Önceki denemeler okunamadı.')

  const { error: attemptError } = await supabase.from('attempts').insert({
    user_id: user.id,
    question_id: question.id,
    topic_id: question.topic_id,
    source: 'video_checkpoint',
    selected_option: input.selectedOption,
    is_correct: isCorrect,
    time_spent_ms: input.timeSpentMs,
    repeat_index: count ?? 0,
  })

  if (attemptError) throw new AppError('internal', 'Cevabınız kaydedilemedi.')

  // Checkpoint cevabı da bir çözümdür: konunun yetkinliği hemen tazelenir,
  // panel iki saniye içinde güncel olsun (spec §M6). Hata yutulur — puanlama
  // aksaklığı kaydedilmiş cevabı geri almamalı.
  await recalculateQuietly(admin, user.id, [question.topic_id])

  return {
    isCorrect,
    correctOption: question.correct_option,
    explanation: question.explanation,
  }
})
