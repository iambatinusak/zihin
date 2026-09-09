import { z } from 'zod'

/**
 * Deneme kurucusu girdisi (spec §M15).
 *
 * ZAMANLAR TAM ISO OLARAK GELİR. `datetime-local` girdisi saat dilimi taşımaz
 * ("2026-06-01T09:00"); sunucuda `new Date()` ile okunursa SUNUCUNUN yerel
 * saatine göre yorumlanır ve editörün kastettiği andan saatlerce kayabilir.
 * Bu yüzden dönüşümü tarayıcı yapar, buraya UTC damgalı ISO gelir.
 */

const optionalIso = z
  .union([z.literal(''), z.string().datetime({ message: 'Geçersiz tarih.' })])
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))

export const CreateMockSchema = z
  .object({
    examId: z.string().uuid({ message: 'Bir sınav seçmelisiniz.' }),
    title: z
      .string()
      .trim()
      .min(1, 'Deneme adı zorunludur.')
      .max(200, 'Deneme adı en fazla 200 karakter olabilir.'),
    durationMinutes: z
      .union([z.literal(''), z.coerce.number().int().min(1).max(600)])
      .optional()
      .transform((value) => (value === '' || value === undefined ? null : value)),
    publishAt: optionalIso,
    liveWindowStart: optionalIso,
    liveWindowEnd: optionalIso,
    isPublished: z.boolean(),
    sections: z
      .array(
        z.object({
          subjectId: z.string().uuid(),
          count: z.coerce.number().int().min(0).max(200),
        }),
      )
      .min(1, 'En az bir ders için soru sayısı girin.')
      .max(30),
  })
  .superRefine((value, ctx) => {
    const { liveWindowStart: start, liveWindowEnd: end } = value

    // Kısmi pencere anlamsız: yalnızca başlangıç varsa deneme hiç kapanmaz,
    // yalnızca bitiş varsa hiç açılmaz.
    if ((start === null) !== (end === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [start === null ? 'liveWindowStart' : 'liveWindowEnd'],
        message: 'Canlı pencere için başlangıç ve bitişin ikisi de gerekli.',
      })
      return
    }

    if (start !== null && end !== null && new Date(end) <= new Date(start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['liveWindowEnd'],
        message: 'Bitiş, başlangıçtan sonra olmalıdır.',
      })
    }

    if (value.sections.every((section) => section.count === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sections'],
        message: 'En az bir ders için soru sayısı girin.',
      })
    }
  })

export type CreateMockInput = z.input<typeof CreateMockSchema>
