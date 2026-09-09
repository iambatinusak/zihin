/**
 * Bildirim türleri — `notifications_type_check` (0007_support.sql) ile birebir.
 *
 * Bu liste `lib/data/notifications.ts` içinde DEĞİL, çünkü orası `server-only`
 * ve türleri istemci tarafı da tanımak zorunda (zil paneli ikon ve etiket
 * seçiyor). Veri katmanı listeyi buradan yeniden dışa aktarır; tek kaynak
 * budur.
 */
export const NOTIFICATION_TYPES = [
  'review_due',
  'plan_reminder',
  'help_answered',
  'weekly_summary',
  'subscription_ending',
  'badge_earned',
  'mock_published',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value)
}

/** Tür bilinmiyorsa listede güvenli bir yere düşer; satır kaybolmaz. */
export const FALLBACK_NOTIFICATION_TYPE: NotificationType = 'plan_reminder'
