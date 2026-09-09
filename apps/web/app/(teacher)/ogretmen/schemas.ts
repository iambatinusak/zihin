import { z } from 'zod'

/** Öğretmen panelinin girdi şemaları (spec §M11). */

const uuid = z.string().uuid('Geçersiz kayıt kimliği.')

export const MAX_ANSWER_LENGTH = 8000

/**
 * Bağlantılar yalnızca `https` kabul eder: `http` karışık içerik uyarısı
 * üretir, `javascript:` ise doğrudan bir XSS yüzeyidir. Markdown temizleyicisi
 * de aynı kuralı uygular; burada erken ve Türkçe bir hata veriyoruz.
 */
const httpsUrl = z
  .string()
  .trim()
  .url('Geçerli bir bağlantı girin (https ile başlamalı).')
  .refine((value) => value.toLowerCase().startsWith('https://'), {
    message: 'Geçerli bir bağlantı girin (https ile başlamalı).',
  })

export const AnswerHelpRequestSchema = z.object({
  requestId: uuid,
  body: z
    .string()
    .trim()
    .min(1, 'Yanıt metni boş olamaz.')
    .max(MAX_ANSWER_LENGTH, `Yanıt en fazla ${MAX_ANSWER_LENGTH} karakter olabilir.`),
  imageUrl: httpsUrl.nullable().optional(),
  videoUrl: httpsUrl.nullable().optional(),
})

export type AnswerHelpRequestInput = z.infer<typeof AnswerHelpRequestSchema>
