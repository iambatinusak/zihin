import { z } from 'zod'

import { videoSourceIssue } from '@/lib/media/video-source'
import { isValidVideoStorageKey } from '@/lib/media/storage'

/**
 * Video yönetimi girdileri (spec §M15).
 *
 * Veritabanındaki `videos_source_check` kısıtı burada bir kez daha
 * uygulanıyor: kısıt yalnızca Postgres'te kalırsa editör alan bazlı Türkçe bir
 * hata yerine ham bir veritabanı hatası görür. Kuralın saf hâli
 * `lib/media/video-source.ts` içindedir ve testlidir.
 */

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value))

const VideoFieldsSchema = z.object({
  topicId: z.string().uuid({ message: 'Geçersiz konu kimliği.' }),
  title: z
    .string()
    .trim()
    .min(1, 'Başlık zorunludur.')
    .max(200, 'Başlık en fazla 200 karakter olabilir.'),
  type: z.enum(['lecture', 'solution', 'summary'], { message: 'Geçersiz video türü.' }),
  provider: z.enum(['supabase', 'bunny'], { message: 'Geçersiz sağlayıcı.' }),
  providerVideoId: optionalText,
  storagePath: optionalText,
  thumbnailUrl: optionalText,
  durationSeconds: z.coerce
    .number()
    .int('Süre tam saniye olmalıdır.')
    .min(0, 'Süre negatif olamaz.')
    .max(60 * 60 * 12, 'Süre en fazla 12 saat olabilir.'),
  orderIndex: z.coerce.number().int('Sıra tam sayı olmalıdır.').min(0, 'Sıra negatif olamaz.'),
  // z.coerce.boolean() KULLANILMAZ: 'false' dizesini true'ya çevirir.
  isFreePreview: z.boolean(),
  isPublished: z.boolean(),
})

/** Sağlayıcı/alan tutarlılığı + storage anahtarının biçimi. */
function refineVideo(value: z.infer<typeof VideoFieldsSchema>, ctx: z.RefinementCtx): void {
  const issue = videoSourceIssue({
    provider: value.provider,
    providerVideoId: value.providerVideoId,
    storagePath: value.storagePath,
  })
  if (issue) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message })
    return
  }

  // İstemciden gelen yol satıra yazılmadan önce biçim denetlenir; aksi hâlde
  // `../` içeren bir anahtar kaydedilebilirdi.
  if (value.provider === 'supabase' && value.storagePath !== null) {
    if (!isValidVideoStorageKey(value.storagePath)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['storagePath'],
        message: 'Video dosyası yolu geçerli değil. Dosyayı yeniden yükleyin.',
      })
    }
  }
}

export const CreateVideoSchema = VideoFieldsSchema.superRefine(refineVideo)

export const UpdateVideoSchema = VideoFieldsSchema.extend({
  id: z.string().uuid({ message: 'Geçersiz video kimliği.' }),
}).superRefine(refineVideo)

export const DeleteVideoSchema = z.object({
  id: z.string().uuid({ message: 'Geçersiz video kimliği.' }),
})

export const SetVideoPublishedSchema = z.object({
  id: z.string().uuid({ message: 'Geçersiz video kimliği.' }),
  isPublished: z.boolean(),
})

/**
 * Durak ekleme. Saniyenin videonun içinde olup olmadığı ve aynı saniyede
 * başka bir durak bulunup bulunmadığı ŞEMADA doğrulanamaz — ikisi de veritabanı
 * okumasına ihtiyaç duyar; denetim action içinde yapılır.
 */
export const AddCheckpointSchema = z.object({
  videoId: z.string().uuid({ message: 'Geçersiz video kimliği.' }),
  questionId: z.string().uuid({ message: 'Bir soru seçmelisiniz.' }),
  timestampSeconds: z.coerce
    .number()
    .int('Zaman tam saniye olmalıdır.')
    .min(0, 'Zaman negatif olamaz.'),
})

export const RemoveCheckpointSchema = z.object({
  id: z.string().uuid({ message: 'Geçersiz durak kimliği.' }),
})

export type CreateVideoInput = z.input<typeof CreateVideoSchema>
export type UpdateVideoInput = z.input<typeof UpdateVideoSchema>
