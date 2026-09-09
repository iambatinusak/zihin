import { section } from '@/lib/i18n/notifications'
import type { NotificationType } from '@/lib/notifications/types'
import type { RelativeTimeStrings } from '@/lib/notifications/format'

/**
 * `i18n/tr/notifications.json` içindeki `notifications` bölümünün şekli.
 * Tipli okunur; silinen bir anahtar derleme zamanında görünür.
 */
export type NotificationStrings = {
  title: string
  description: string
  panelTitle: string
  open: string
  viewAll: string
  markAll: string
  markAllDone: string
  markAllPending: string
  markAllFailed: string
  unreadBadge: string
  loading: string
  loadFailed: string
  emptyTitle: string
  emptyBody: string
  emptyFilterTitle: string
  emptyFilterBody: string
  unreadOnly: string
  filterLabel: string
  filterAll: string
  prefsHint: string
  prefsLink: string
  time: RelativeTimeStrings
  types: Record<NotificationType, string>
}

export function notificationStrings(): NotificationStrings {
  return section<NotificationStrings>('notifications')
}
