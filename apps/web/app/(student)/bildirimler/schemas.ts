import { z } from 'zod'
import { NOTIFICATION_TYPES } from '@/lib/notifications/types'

/** Bildirim action'larının girdi şemaları. */

export const MarkNotificationReadSchema = z.object({
  notificationId: z.string().uuid('Geçerli bir bildirim seçin.'),
})

export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadSchema>

/** Zil açıldığında çekilen liste; sınır sunucuda ayrıca kısılır. */
export const FetchRecentNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
})

export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES)

/** `/bildirimler?tur=...` sorgu değerini güvenle çözer. */
export function parseTypeFilter(value: unknown): (typeof NOTIFICATION_TYPES)[number] | null {
  const parsed = NotificationTypeSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
