import { z } from 'zod'

/**
 * Elle abonelik tanımlama girdisi (spec §M14).
 *
 * Süre opsiyoneldir; verilmezse paketin kendi `duration_days` değeri
 * kullanılır. VERİLDİĞİNDE DE bir tutar ya da fiyat alanı YOKTUR — elle
 * tanımlama bir tahsilat değildir, `payments` satırı açmaz.
 */
export const GrantSubscriptionSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'E-posta adresi zorunludur.')
    .email('Geçerli bir e-posta adresi girin.')
    .toLowerCase(),
  packageId: z.string().uuid({ message: 'Geçersiz paket kimliği.' }),
  durationDays: z.coerce
    .number()
    .int('Süre tam gün olmalıdır.')
    .min(1, 'Süre en az 1 gün olmalıdır.')
    .max(1095, 'Süre en fazla 1095 gün (3 yıl) olabilir.')
    .optional(),
})

export type GrantSubscriptionInput = z.infer<typeof GrantSubscriptionSchema>
