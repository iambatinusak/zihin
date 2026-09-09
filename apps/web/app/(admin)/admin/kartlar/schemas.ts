import { z } from 'zod'

/** Bilgi kartı düzenleyicisi girdileri (spec §M15). */

const markdown = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} zorunludur.`)
    .max(4000, `${label} en fazla 4000 karakter olabilir.`)

const optionalUrl = z
  .union([z.literal(''), z.string().trim().max(500)])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))

const CardFieldsSchema = z.object({
  topicId: z.string().uuid({ message: 'Bir konu seçmelisiniz.' }),
  front: markdown('Ön yüz'),
  back: markdown('Arka yüz'),
  imageUrl: optionalUrl,
  isPublished: z.boolean(),
})

export const CreateFlashcardSchema = CardFieldsSchema

export const UpdateFlashcardSchema = CardFieldsSchema.extend({
  id: z.string().uuid({ message: 'Geçersiz kart kimliği.' }),
})

export const DeleteFlashcardSchema = z.object({
  id: z.string().uuid({ message: 'Geçersiz kart kimliği.' }),
})
