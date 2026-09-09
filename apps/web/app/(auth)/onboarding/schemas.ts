import { z } from 'zod'

/**
 * Onboarding sihirbazının adım şemaları.
 *
 * Bu dosya bilinçli olarak `server-only` DEĞİLDİR: istemci bileşeni de aynı
 * sabitleri (seçenek listeleri, sınıf değerleri) kullanır ve tek kaynaktan
 * okunması iki tarafın ayrışmasını engeller.
 */

/** Sihirbazın toplam adım sayısı; `profiles.onboarding_step` 0..6 aralığındadır. */
export const TOTAL_STEPS = 6

/** Sihirbazda seçilebilen roller. Diğer roller (öğretmen, editör) davetle atanır. */
export const ONBOARDING_ROLES = ['student', 'parent'] as const
export type OnboardingRole = (typeof ONBOARDING_ROLES)[number]

/**
 * `profiles.grade` check kısıtıyla birebir aynı liste
 * (bkz. supabase/migrations/0002_identity.sql — profiles_grade_check).
 */
export const GRADES = ['8', '9', '10', '11', '12', 'mezun', 'yetiskin'] as const
export type Grade = (typeof GRADES)[number]

/** Günlük çalışma süresi seçenekleri (dakika). */
export const DAILY_MINUTES_OPTIONS = [30, 60, 120, 180] as const
export type DailyMinutes = (typeof DAILY_MINUTES_OPTIONS)[number]

/** Varsayılan çalışma günleri: Pazartesi–Cumartesi (1=Pazartesi ... 7=Pazar). */
export const DEFAULT_STUDY_DAYS = [1, 2, 3, 4, 5, 6]

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarihi GG.AA.YYYY biçiminde seçin.')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: 'Geçerli bir tarih seçin.',
  })
  .refine((value) => {
    const year = Number(value.slice(0, 4))
    return year >= 2000 && year <= 2100
  }, 'Tarih 2000–2100 aralığında olmalı.')

export const RoleStepSchema = z.object({
  step: z.literal(1),
  role: z.enum(ONBOARDING_ROLES, { errorMap: () => ({ message: 'Bir rol seçin.' }) }),
})

export const ExamStepSchema = z.object({
  step: z.literal(2),
  examId: z.string().uuid('Bir hedef sınav seçin.'),
})

export const GradeStepSchema = z.object({
  step: z.literal(3),
  grade: z.enum(GRADES, { errorMap: () => ({ message: 'Sınıf ya da durum seçin.' }) }),
})

/**
 * Geçmiş bir tarih burada REDDEDİLMEZ: kullanıcı uyarılır ama devam edebilir —
 * plan üreticisi geçmiş tarihi kendi ele alır (spec §M1).
 */
export const ExamDateStepSchema = z.object({
  step: z.literal(4),
  targetExamDate: isoDate,
})

export const ScheduleStepSchema = z.object({
  step: z.literal(5),
  dailyMinutes: z
    .number()
    .int()
    .refine(
      (value): value is DailyMinutes =>
        (DAILY_MINUTES_OPTIONS as readonly number[]).includes(value),
      'Geçerli bir çalışma süresi seçin.',
    ),
  studyDays: z
    .array(z.number().int().min(1).max(7))
    .min(1, 'En az bir çalışma günü seçin.')
    .max(7)
    .refine((days) => new Set(days).size === days.length, 'Aynı gün iki kez seçilemez.'),
})

/**
 * Adım makinesinin tip güvenliği bu ayrık birlikten gelir: `step` alanı
 * daraltıldığında yalnızca o adıma ait alanlar erişilebilir olur.
 */
export const OnboardingStepInputSchema = z.discriminatedUnion('step', [
  RoleStepSchema,
  ExamStepSchema,
  GradeStepSchema,
  ExamDateStepSchema,
  ScheduleStepSchema,
])

export type OnboardingStepInput = z.infer<typeof OnboardingStepInputSchema>

/** 6. adım: seviye tespit sınavına başla ya da şimdilik atla. */
export const CompleteOnboardingSchema = z.object({
  startPlacement: z.boolean(),
})

export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingSchema>
