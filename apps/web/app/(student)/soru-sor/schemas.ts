import { z } from 'zod'

/**
 * Soru Çözücü'nün girdi şemaları (spec §M11).
 *
 * Bir Server Action AÇIK BİR UÇTUR: tarayıcının gönderdiği hiçbir sayı, sınır
 * ya da uygunluk kararı burada kabul edilmez. Kota, dosya boyutu ve türü,
 * konunun derse ait olup olmadığı — hepsi sunucuda yeniden hesaplanır. Bu
 * dosya yalnızca BİÇİM doğrular.
 */

const uuid = z.string().uuid('Geçersiz kayıt kimliği.')

/** Soru metninin üst sınırı: tek bir soru, deneme değil. */
export const MAX_BODY_LENGTH = 2000

const body = z
  .string()
  .trim()
  .max(MAX_BODY_LENGTH, `Soru metni en fazla ${MAX_BODY_LENGTH} karakter olabilir.`)

/**
 * Yüklenen görselin NESNE ANAHTARI (`<user_id>/<ad>.<uzantı>`) — imzalı URL
 * değil. Sunucu anahtarın gerçekten çağıranın klasöründe olduğunu ayrıca
 * doğrular (bkz. lib/help/storage.ts → isOwnHelpUploadKey).
 */
const imageKey = z
  .string()
  .trim()
  .max(300, 'Dosya yolu çok uzun.')
  .regex(/^[A-Za-z0-9._/-]+$/, 'Geçersiz dosya yolu.')

export const AskQuestionSchema = z
  .object({
    subjectId: uuid,
    topicId: uuid.nullable().optional(),
    body: body.optional(),
    imageKey: imageKey.nullable().optional(),
  })
  .refine((value) => (value.body ?? '').length > 0 || Boolean(value.imageKey), {
    // Veritabanındaki `help_requests_body_image_url_check` kısıtının anlamı;
    // Postgres'in ham hatasını göstermek yerine alan hatası olarak veriyoruz.
    message: 'En az bir alan dolu olmalı: metin ya da fotoğraf.',
    path: ['body'],
  })

export type AskQuestionInput = z.infer<typeof AskQuestionSchema>

export const AcceptSimilarQuestionSchema = z.object({
  requestId: uuid,
  questionId: uuid,
})

export const DismissSimilarQuestionsSchema = z.object({
  requestId: uuid,
})

export const SendHelpMessageSchema = z.object({
  requestId: uuid,
  body: body.min(1, 'Mesaj boş olamaz.'),
})

export const CloseHelpRequestSchema = z.object({
  requestId: uuid,
})
