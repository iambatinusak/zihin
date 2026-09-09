'use server'

import { revalidatePath } from 'next/cache'
import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fill } from '@/lib/i18n'
import { helpStrings } from '@/components/help/strings'
import { isAllowedImageSize, isAllowedImageType, MAX_IMAGE_BYTES } from '@/lib/help/image'
import { quotaState, turkeyDayWindow } from '@/lib/help/limits'
import { HELP_UPLOADS_BUCKET, isOwnHelpUploadKey } from '@/lib/help/storage'
import { MAX_MESSAGES_PER_REQUEST, toHelpAppError } from '@/lib/help/db-errors'
import {
  countHelpMessages,
  countRequestsInWindow,
  getDailyQuestionLimit,
  getHelpRequest,
  getSubjectIdForTopic,
  searchSimilarQuestions,
  type SimilarQuestion,
} from '@/lib/data/help'
import {
  AcceptSimilarQuestionSchema,
  AskQuestionSchema,
  CloseHelpRequestSchema,
  DismissSimilarQuestionsSchema,
  SendHelpMessageSchema,
} from './schemas'

/**
 * Soru Çözücü — öğrenci tarafının mutasyonları (spec §M11).
 *
 * ÜÇ DEĞİŞMEZ KURAL:
 *
 *  1. GÜNLÜK KOTA SUNUCUDA SAYILIR. Arayüz kalan hakkı gösterir ama düğmeyi
 *     kapatması bir denetim değildir; sayım her gönderimde `help_requests`
 *     üzerinde, Türkiye gün sınırıyla yeniden yapılır.
 *  2. YÜKLENEN DOSYA SUNUCUDA DOĞRULANIR. Tarayıcıdaki küçültme bir
 *     kolaylıktır; tür ve boyut nesnenin kendi meta verisinden okunur, geçersiz
 *     dosya kaydedilmez ve depodan silinir.
 *  3. BENZER SORU EŞLEŞMESİ SUNUCUDA HESAPLANIR. İstemci "şu sorular benziyor"
 *     diyemez; `matched_question_ids` yalnızca sunucunun kendi aramasından
 *     yazılır, kabul edilen soru da o listenin içinde olmak zorundadır.
 */

/** Benzer soru olarak gösterilecek en fazla kayıt (spec §M11: ilk 3). */
const SIMILAR_LIMIT = 3

export type AskQuestionResult = {
  requestId: string
  /** Sunucunun bulduğu benzer sorular; boşsa soru doğrudan kuyrukta. */
  matches: SimilarQuestion[]
  /** Bu gönderimden SONRAKİ kota durumu. */
  remaining: number
}

/**
 * Soruyu kaydeder ve benzer soruları arar.
 *
 * Sıra önemli: önce kota, sonra dosya, sonra kayıt. Benzer soru araması kayıttan
 * sonra yapılır ve sonucu satıra yazılır — arama başarısız olsa bile soru
 * kaybolmaz, sadece "bunlardan biri mi?" adımı atlanır.
 */
export const askQuestion = action(AskQuestionSchema, async (input): Promise<AskQuestionResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()
  const s = helpStrings()

  // 1 — Kota. Gün sınırı `public.tr_today()` ile aynı yerden geçer.
  const window = turkeyDayWindow(new Date())
  const limit = await getDailyQuestionLimit(supabase, user.id)
  const used = await countRequestsInWindow(supabase, user.id, window)
  const quota = quotaState(limit, used)

  if (quota.exhausted) {
    throw new AppError(
      'rate_limited',
      quota.limit === 0 ? s.quotaZero : fill(s.quotaExhaustedServer, { limit: quota.limit }),
    )
  }

  // 2 — Konu gerçekten bu derse mi ait? İstemci ikisini bağımsız gönderiyor.
  const topicId = input.topicId ?? null
  if (topicId) {
    const owningSubject = await getSubjectIdForTopic(supabase, topicId)
    if (owningSubject === null) {
      throw new AppError('not_found', 'Seçtiğiniz konu bulunamadı.')
    }
    if (owningSubject !== input.subjectId) {
      throw new AppError('validation', 'Seçilen konu bu derse ait değil.', {
        topicId: ['Seçilen konu bu derse ait değil.'],
      })
    }
  }

  // 3 — Dosya. Anahtar çağıranın klasöründe olmalı (0012 politikasıyla aynı
  // kural), tür ve boyut nesnenin meta verisinden okunur.
  const imageKey = input.imageKey?.trim() || null
  if (imageKey) {
    await assertUploadedImageIsValid(user.id, imageKey)
  }

  const bodyText = input.body?.trim() || null

  const { data: created, error } = await supabase
    .from('help_requests')
    .insert({
      student_id: user.id,
      subject_id: input.subjectId,
      topic_id: topicId,
      body: bodyText,
      image_url: imageKey,
      status: 'open',
    })
    .select('id')
    .single()

  if (error || !created) {
    throw toHelpAppError(error, 'Sorunuz gönderilemedi. Lütfen tekrar deneyin.')
  }

  // 4 — Benzer soru araması (spec §M11). Metin yoksa arama yapılmaz: fotoğraf
  // üzerinden trigram benzerliği hesaplanamaz.
  const matches = bodyText
    ? await searchSimilarQuestions(supabase, {
        query: bodyText,
        topicId,
        limit: SIMILAR_LIMIT,
      })
    : []

  if (matches.length > 0) {
    await supabase
      .from('help_requests')
      .update({ matched_question_ids: matches.map((match) => match.id) })
      .eq('id', created.id)
      .eq('student_id', user.id)
  }

  revalidatePath('/soru-sor')
  return {
    requestId: created.id,
    matches,
    remaining: Math.max(0, quota.remaining - 1),
  }
})

/**
 * Öğrenci "evet, aradığım soru buydu" dedi: soru kapanır, öğretmene gitmez.
 * Bu modülün asıl kazancı budur (spec §M11).
 *
 * Kabul edilen soru, SUNUCUNUN bulduğu eşleşme listesinde olmak zorundadır;
 * aksi hâlde istemci istediği soru kimliğini yazdırabilirdi.
 */
export const acceptSimilarQuestion = action(AcceptSimilarQuestionSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const request = await getHelpRequest(supabase, input.requestId)
  assertOwnRequest(request.student_id, user.id)

  if (!request.matched_question_ids.includes(input.questionId)) {
    throw new AppError('forbidden', 'Bu soru, önerilen benzer sorular arasında değil.')
  }

  const { error } = await supabase
    .from('help_requests')
    .update({ status: 'closed' })
    .eq('id', request.id)
    .eq('student_id', user.id)

  if (error) throw toHelpAppError(error, 'Soru kapatılamadı.')

  revalidatePath('/soru-sor')
  revalidatePath(`/soru-sor/${request.id}`)
  return { closed: true }
})

/**
 * Öğrenci "hiçbiri değil" dedi: soru öğretmen kuyruğunda kalır.
 * Öneri listesi temizlenir; böylece arayüz aynı soruyu tekrar sormaz.
 */
export const dismissSimilarQuestions = action(DismissSimilarQuestionsSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const request = await getHelpRequest(supabase, input.requestId)
  assertOwnRequest(request.student_id, user.id)

  const { error } = await supabase
    .from('help_requests')
    .update({ matched_question_ids: [] })
    .eq('id', request.id)
    .eq('student_id', user.id)

  if (error) throw toHelpAppError(error, 'İşlem tamamlanamadı.')

  revalidatePath('/soru-sor')
  revalidatePath(`/soru-sor/${request.id}`)
  return { queued: true }
})

/**
 * Soru altına mesaj yazar.
 *
 * 5 mesaj sınırı asıl olarak veritabanı trigger'ıyla (0007) zorlanır; burada
 * önden sayılmasının sebebi kullanıcıya doğru Türkçe mesajı verebilmek. Yarışta
 * trigger kazanır ve hatası yine Türkçeye çevrilir (lib/help/db-errors.ts).
 */
export const sendHelpMessage = action(SendHelpMessageSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const request = await getHelpRequest(supabase, input.requestId)
  assertOwnRequest(request.student_id, user.id)

  if (request.status === 'closed') {
    throw new AppError('conflict', 'Kapalı bir soruya mesaj gönderilemez.')
  }

  const count = await countHelpMessages(supabase, request.id)
  if (count >= MAX_MESSAGES_PER_REQUEST) {
    throw new AppError(
      'conflict',
      'Bu soru altında en fazla 5 mesaj gönderilebilir. Yeni bir soru sorabilirsiniz.',
    )
  }

  const { error } = await supabase.from('help_messages').insert({
    request_id: request.id,
    sender_id: user.id,
    body: input.body,
  })

  if (error) throw toHelpAppError(error, 'Mesaj gönderilemedi. Lütfen tekrar deneyin.')

  revalidatePath(`/soru-sor/${request.id}`)
  return { sent: true, remaining: MAX_MESSAGES_PER_REQUEST - (count + 1) }
})

/** Öğrenci soruyu kapatır. */
export const closeHelpRequest = action(CloseHelpRequestSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const request = await getHelpRequest(supabase, input.requestId)
  assertOwnRequest(request.student_id, user.id)

  const { error } = await supabase
    .from('help_requests')
    .update({ status: 'closed' })
    .eq('id', request.id)
    .eq('student_id', user.id)

  if (error) throw toHelpAppError(error, 'Soru kapatılamadı.')

  revalidatePath('/soru-sor')
  revalidatePath(`/soru-sor/${request.id}`)
  return { closed: true }
})

/* ------------------------------------------------------------------------- *
 * Yardımcılar
 * ------------------------------------------------------------------------- */

function assertOwnRequest(ownerId: string, userId: string): void {
  if (ownerId !== userId) {
    throw new AppError('forbidden', 'Bu soru size ait değil.')
  }
}

/**
 * Yüklenmiş nesnenin gerçekten kabul edilebilir bir görsel olduğunu doğrular.
 *
 * Neden service-role: `storage.objects` üzerinde okuma hakkı var ama meta veri
 * listelemesi kova kökünden yapılıyor; ayrıca geçersiz dosyayı SİLMEK gerekiyor
 * ve silme yalnızca admin'e açık (0012). Sorgu doğrudan kullanıcı girdisiyle
 * parametrelenmiyor: klasör her zaman oturumdaki kullanıcının kimliği.
 */
async function assertUploadedImageIsValid(userId: string, key: string): Promise<void> {
  if (!isOwnHelpUploadKey(key, userId)) {
    throw new AppError('forbidden', 'Bu dosya size ait değil.')
  }

  const admin = createSupabaseAdminClient()
  const fileName = key.slice(userId.length + 1)

  const { data, error } = await admin.storage
    .from(HELP_UPLOADS_BUCKET)
    .list(userId, { search: fileName, limit: 1 })

  if (error) {
    console.error('[help] yüklenen dosya okunamadı:', error)
    throw new AppError('internal', 'Fotoğraf doğrulanamadı. Lütfen tekrar deneyin.')
  }

  const object = (data ?? []).find((entry) => entry.name === fileName)
  if (!object) {
    throw new AppError('not_found', 'Yüklenen fotoğraf bulunamadı. Lütfen tekrar deneyin.')
  }

  const metadata = (object.metadata ?? {}) as { size?: number; mimetype?: string }
  const size = typeof metadata.size === 'number' ? metadata.size : 0
  const mimetype = typeof metadata.mimetype === 'string' ? metadata.mimetype : ''

  if (!isAllowedImageType(mimetype)) {
    await removeUpload(admin, key)
    throw new AppError(
      'validation',
      'Yalnızca JPEG, PNG, WEBP ya da HEIC fotoğraf gönderebilirsiniz.',
      {
        imageKey: ['Yalnızca JPEG, PNG, WEBP ya da HEIC fotoğraf gönderebilirsiniz.'],
      },
    )
  }

  if (!isAllowedImageSize(size)) {
    await removeUpload(admin, key)
    throw new AppError(
      'validation',
      `Fotoğraf ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB'tan büyük olamaz.`,
      { imageKey: ["Fotoğraf 5 MB'tan büyük olamaz."] },
    )
  }
}

/** Reddedilen yükleme depoda çöp bırakmasın. Hata yutulur: asıl işlem zaten durdu. */
async function removeUpload(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  key: string,
): Promise<void> {
  try {
    await admin.storage.from(HELP_UPLOADS_BUCKET).remove([key])
  } catch (error) {
    console.error('[help] geçersiz yükleme silinemedi:', error)
  }
}
