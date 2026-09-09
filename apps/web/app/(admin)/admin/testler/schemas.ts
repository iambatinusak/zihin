import { z } from 'zod'

/**
 * Test kurucusu girdileri (spec §M15).
 *
 * İki soru seçme yolu var ve ikisi de AYNI sonuca varır: `test_questions`
 * satırları. "Rastgele N soru" bir çalışma zamanı kuralı DEĞİLDİR; testin
 * oluşturulduğu anda çözülür ve sabitlenir (bkz. `actions.ts`).
 */

const optionalMinutes = z
  .union([z.literal(''), z.coerce.number().int().min(1).max(600)])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))

export const CreateTestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Test adı zorunludur.')
      .max(200, 'Test adı en fazla 200 karakter olabilir.'),
    type: z.enum(['topic_test', 'unit_test'], { message: 'Geçersiz test türü.' }),
    topicId: z.string().uuid({ message: 'Bir konu seçmelisiniz.' }),
    durationMinutes: optionalMinutes,
    isPublished: z.boolean(),
    mode: z.enum(['manual', 'random'], { message: 'Geçersiz seçim yöntemi.' }),
    questionIds: z.array(z.string().uuid()).max(200).default([]),
    randomCount: z.coerce
      .number()
      .int('Soru sayısı tam sayı olmalıdır.')
      .min(1, 'En az 1 soru seçilmelidir.')
      .max(200, 'En fazla 200 soru seçilebilir.')
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'manual' && value.questionIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questionIds'],
        message: 'En az bir soru seçmelisiniz.',
      })
    }
    if (value.mode === 'random' && value.randomCount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['randomCount'],
        message: 'Kaç soru seçileceğini yazın.',
      })
    }
  })

export const UpdateTestSchema = z.object({
  id: z.string().uuid({ message: 'Geçersiz test kimliği.' }),
  title: z
    .string()
    .trim()
    .min(1, 'Test adı zorunludur.')
    .max(200, 'Test adı en fazla 200 karakter olabilir.'),
  durationMinutes: optionalMinutes,
  isPublished: z.boolean(),
})

export const SetTestPublishedSchema = z.object({
  id: z.string().uuid({ message: 'Geçersiz test kimliği.' }),
  isPublished: z.boolean(),
})

export const DeleteTestSchema = z.object({
  id: z.string().uuid({ message: 'Geçersiz test kimliği.' }),
})

/** Sıralama TAM liste olarak gönderilir; kısmi güncelleme sırayı bozardı. */
export const ReorderTestQuestionsSchema = z.object({
  testId: z.string().uuid({ message: 'Geçersiz test kimliği.' }),
  questionIds: z.array(z.string().uuid()).min(1, 'Testte en az bir soru kalmalı.').max(200),
})

export const RemoveTestQuestionSchema = z.object({
  testId: z.string().uuid({ message: 'Geçersiz test kimliği.' }),
  questionId: z.string().uuid({ message: 'Geçersiz soru kimliği.' }),
})

export const AddTestQuestionSchema = z.object({
  testId: z.string().uuid({ message: 'Geçersiz test kimliği.' }),
  questionId: z.string().uuid({ message: 'Geçersiz soru kimliği.' }),
})
