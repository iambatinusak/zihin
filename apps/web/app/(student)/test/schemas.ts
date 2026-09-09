import { z } from 'zod'

/**
 * Test motorunun Server Action girdileri.
 *
 * Şemalar ayrı dosyada: `actions.ts` `'use server'` taşıdığı için oradan
 * yalnızca `async` fonksiyon dışa aktarılabilir; şema sabitleri orada duramaz.
 */

const Uuid = z.string().uuid({ message: 'Geçersiz kayıt kimliği.' })

/**
 * Test başlatma. İki biçimden biri gelir:
 *  - `{ testId }` — yayımlanmış bir testi çözmek,
 *  - `{ type: 'quick_practice', topicId? }` — 5 soruluk hızlı tekrar.
 *    `topicId` verilmezse kullanıcının en zayıf konusu seçilir (spec §M5).
 */
export const StartTestSchema = z.union([
  z.object({ testId: Uuid }),
  z.object({
    type: z.literal('quick_practice'),
    topicId: Uuid.optional(),
  }),
])

export type StartTestInput = z.infer<typeof StartTestSchema>

/**
 * Cevap kaydetme. `selectedOption` null gelebilir: öğrenci işaretlediği şıkkı
 * geri alabilir ve bu "boş bıraktım" demektir, yanlış demek değildir.
 * Şık anahtarı serbest metin değil, kısa bir etikettir (A-E, D/Y gibi).
 */
export const SubmitAnswerSchema = z.object({
  sessionId: Uuid,
  questionId: Uuid,
  selectedOption: z.string().trim().min(1).max(8).nullable(),
  // Üst sınır 6 saat: sekmesi açık unutulmuş bir tarayıcıdan gelen saçma
  // süreler istatistiği bozmasın.
  timeSpentMs: z
    .number()
    .int()
    .min(0)
    .max(6 * 60 * 60 * 1000)
    .default(0),
})

export const FinishTestSchema = z.object({ sessionId: Uuid })

export const GetResultSchema = z.object({ sessionId: Uuid })

export const BookmarkQuestionSchema = z.object({
  questionId: Uuid,
  note: z
    .string()
    .trim()
    .max(1000, 'Not en fazla 1000 karakter olabilir.')
    .nullable()
    .default(null),
})

export const RemoveBookmarkSchema = z.object({ questionId: Uuid })
