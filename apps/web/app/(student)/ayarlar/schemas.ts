import { z } from 'zod'

/**
 * Ayarlar sayfasının girdi şemaları.
 *
 * Buradaki her sınır, veritabanındaki bir `check` kısıtının aynısıdır
 * (0002_identity.sql): daily_minutes 15..720, study_days 1..7 arası ve boş
 * değil, grade sabit listeden. İkisi birbirinden ayrılırsa kullanıcı alan
 * hatası yerine ham Postgres hatası görür — bu yüzden testleri de var.
 */

/** profiles_grade_check ile birebir aynı liste. */
export const GRADES = ['8', '9', '10', '11', '12', 'mezun', 'yetiskin'] as const
export type Grade = (typeof GRADES)[number]

/** 1 = Pazartesi ... 7 = Pazar (profiles.study_days yorumu). */
export const STUDY_DAYS = [1, 2, 3, 4, 5, 6, 7] as const

export const MIN_DAILY_MINUTES = 15
export const MAX_DAILY_MINUTES = 720

/** Boş metni null'a çeviren yardımcı; form alanları boş string gönderir. */
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

export const ProfileSettingsSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Ad soyad en az 2 karakter olmalı.')
    .max(80, 'Ad soyad en fazla 80 karakter olabilir.'),
  displayName: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .min(2, 'Görünen ad en az 2 karakter olmalı.')
      .max(24, 'Görünen ad en fazla 24 karakter olabilir.')
      .nullable(),
  ),
  avatarUrl: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .url('Geçerli bir görsel adresi girin.')
      .max(500, 'Bağlantı en fazla 500 karakter olabilir.')
      .refine((value) => value.startsWith('https://'), 'Görsel adresi https:// ile başlamalı.')
      .nullable(),
  ),
  grade: z.preprocess(
    emptyToNull,
    z.enum(GRADES, { errorMap: () => ({ message: 'Geçerli bir sınıf seçin.' }) }).nullable(),
  ),
})

export type ProfileSettingsInput = z.infer<typeof ProfileSettingsSchema>

/** ISO tarih (YYYY-AA-GG); <input type="date"> bu biçimi üretir. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçerli bir tarih girin.')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Geçerli bir tarih girin.')

export const StudySettingsSchema = z.object({
  examId: z.preprocess(emptyToNull, z.string().uuid('Geçerli bir sınav seçin.').nullable()),
  targetExamDate: z.preprocess(emptyToNull, isoDate.nullable()),
  dailyMinutes: z.coerce
    .number({ invalid_type_error: 'Günlük süre bir sayı olmalı.' })
    .int('Günlük süre tam sayı olmalı.')
    .min(MIN_DAILY_MINUTES, `Günlük süre en az ${MIN_DAILY_MINUTES} dakika olabilir.`)
    .max(MAX_DAILY_MINUTES, `Günlük süre en fazla ${MAX_DAILY_MINUTES} dakika olabilir.`),
  studyDays: z
    .array(
      z.coerce
        .number()
        .int()
        .min(1, 'Gün değeri 1-7 arasında olmalı.')
        .max(7, 'Gün değeri 1-7 arasında olmalı.'),
    )
    .min(1, 'En az bir çalışma günü seçmelisin.')
    .max(7, 'En fazla 7 gün seçilebilir.')
    .refine((days) => new Set(days).size === days.length, 'Aynı gün iki kez seçilemez.')
    .transform((days) => [...days].sort((a, b) => a - b)),
})

export type StudySettingsInput = z.infer<typeof StudySettingsSchema>

export const NotificationPrefsSchema = z.object({
  email_reminders: z.boolean(),
  email_weekly_summary: z.boolean(),
  app_notifications: z.boolean(),
})

export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  email_reminders: true,
  email_weekly_summary: true,
  app_notifications: true,
}

/** Bilinmeyen jsonb değerini güvenle tercih nesnesine çevirir. */
export function parseNotificationPrefs(value: unknown): NotificationPrefs {
  const parsed = NotificationPrefsSchema.safeParse(value)
  if (parsed.success) return parsed.data

  // Eksik anahtar varsa tamamı çöpe atılmaz; bilinenler korunur.
  const partial = NotificationPrefsSchema.partial().safeParse(value)
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(partial.success ? partial.data : {}) }
}

export const LeaderboardOptInSchema = z.object({ optIn: z.boolean() })

/**
 * Davet kodu tanımı `lib/invite-code.ts` içinde tektir; kayıt formu da aynı
 * kaynağı kullanır. Buradan yeniden dışa aktarılıyor ki mevcut içe aktarımlar
 * (`@/app/(student)/ayarlar/schemas`) kırılmasın.
 */
export {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  InviteCodeSchema,
  normalizeInviteCode,
  type InviteCodeInput,
} from '@/lib/invite-code'

/**
 * Bağlantıyı iki taraf da kesebilir (RLS `parent_links_delete_either_side`).
 * Oturumdaki kullanıcının kendi tarafı sunucuda bulunur; istemci yalnızca
 * KARŞI tarafın kimliğini gönderir.
 */
export const UnlinkParentSchema = z
  .object({
    parentId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
  })
  .refine(
    (value) => Boolean(value.parentId) || Boolean(value.studentId),
    'Bağlantısı kesilecek kişi belirtilmedi.',
  )

export type UnlinkParentInput = z.infer<typeof UnlinkParentSchema>
