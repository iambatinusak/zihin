import { z } from 'zod'

import { ISO_DATE_PATTERN, isIsoDate } from '@/lib/plan/week'

/** Program ekranındaki tüm Server Action girdilerinin şemaları. */

const uuid = z.string().uuid('Geçersiz kayıt kimliği.')

/**
 * "YYYY-MM-DD". Biçim denetimi yetmez — 2025-02-31 biçime uyar ama takvimde
 * yoktur; `isIsoDate` gerçekten çözümlenebildiğini doğrular.
 */
const isoDate = z
  .string()
  .regex(ISO_DATE_PATTERN, 'Geçersiz tarih biçimi.')
  .refine(isIsoDate, 'Geçersiz tarih.')

export const PLAN_TEMPLATES = ['balanced', 'video_only', 'test_only', 'last_30_days'] as const

export const RegeneratePlanSchema = z.object({
  template: z.enum(PLAN_TEMPLATES).optional(),
  /** Yenilenecek haftanın Pazartesi'si; verilmezse içinde bulunulan hafta. */
  weekStart: isoDate.optional(),
})

export const MoveBlockSchema = z.object({
  blockId: uuid,
  toDate: isoDate,
})

export const BlockIdSchema = z.object({ blockId: uuid })
