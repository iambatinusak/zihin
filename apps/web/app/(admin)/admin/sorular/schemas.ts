import { z } from 'zod'
import {
  MAX_DIFFICULTY,
  MAX_OPTIONS,
  MIN_DIFFICULTY,
  MIN_OPTIONS,
  OPTION_KEYS,
} from '@/lib/admin/questions/options'

/**
 * Soru düzenleyici ve toplu içe aktarmanın girdi şemaları.
 * Mesajlar Türkçe: `action()` bunları alan bazlı hata olarak istemciye döner.
 */

/** Yüklenecek dosyanın en büyük boyutu (metin olarak). */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .default(null)

export const QuestionOptionSchema = z.object({
  key: z.enum(OPTION_KEYS),
  text: z.string().trim().min(1, 'Şık metni boş olamaz.').max(2000, 'Şık metni çok uzun.'),
})

export const SaveQuestionSchema = z.object({
  /** Boşsa yeni kayıt; doluysa güncelleme. */
  id: z.string().uuid().nullable().default(null),
  topicId: z.string().uuid('Bir konu seçin.'),
  outcomeId: z.string().uuid().nullable().default(null),
  stem: z
    .string()
    .trim()
    .min(1, 'Soru kökü boş olamaz.')
    .max(10_000, 'Soru kökü en fazla 10.000 karakter olabilir.'),
  options: z
    .array(QuestionOptionSchema)
    .min(MIN_OPTIONS, `Soru en az ${MIN_OPTIONS} şık içermeli.`)
    .max(MAX_OPTIONS, `Soru en fazla ${MAX_OPTIONS} şık içerebilir.`),
  correctOption: z.enum(OPTION_KEYS, { errorMap: () => ({ message: 'Doğru şıkkı seçin.' }) }),
  explanation: optionalText(10_000),
  solutionVideoUrl: z
    .string()
    .trim()
    .max(500)
    .url('Geçerli bir bağlantı girin.')
    .nullable()
    .or(z.literal('').transform(() => null))
    .default(null),
  difficulty: z
    .number()
    .int()
    .min(MIN_DIFFICULTY, `Zorluk en az ${MIN_DIFFICULTY} olmalı.`)
    .max(MAX_DIFFICULTY, `Zorluk en fazla ${MAX_DIFFICULTY} olmalı.`),
  expectedSeconds: z
    .number()
    .int('Beklenen süre tam sayı olmalı.')
    .positive('Beklenen süre pozitif olmalı.')
    .max(3600, 'Beklenen süre en fazla 3600 saniye olabilir.')
    .nullable()
    .default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(20, 'En fazla 20 etiket eklenebilir.'),
  isPublished: z.boolean(),
  /**
   * Görsel üç durumu taşır:
   *   undefined → mevcut görsele dokunma,
   *   null      → görseli kaldır,
   *   string    → kovaya yüklenmiş yeni nesne anahtarı.
   */
  imageKey: z.string().trim().min(1).max(400).nullable().optional(),
})

export type SaveQuestionInput = z.infer<typeof SaveQuestionSchema>

export const SetPublishedSchema = z.object({
  id: z.string().uuid(),
  isPublished: z.boolean(),
})

export const DeleteQuestionSchema = z.object({
  id: z.string().uuid(),
})

/**
 * İçe aktarma girdisi: DOSYANIN KENDİSİ.
 *
 * İstemcinin ayrıştırdığı satırlar değil ham metin gönderilir. Sebep: önizleme
 * ile yazma aynı saf koddan geçsin. Aksi hâlde istemci önizlemede gördüğünden
 * başka satırlar gönderebilirdi ve "önce gör, sonra aktar" sözü boşa çıkardı.
 */
export const ImportFileSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  content: z
    .string()
    .max(MAX_IMPORT_BYTES, 'Dosya çok büyük (en fazla 2 MB).')
    .min(1, 'Dosya boş görünüyor.'),
})

export type ImportFileInput = z.infer<typeof ImportFileSchema>

/** Dosya doğrulandıktan sonra gerçekten yazan çağrı. */
export const ImportCommitSchema = ImportFileSchema.extend({
  /** Yayına açık mı eklensin? Varsayılan: taslak. */
  publish: z.boolean().default(false),
})
