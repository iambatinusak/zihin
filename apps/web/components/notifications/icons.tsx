import {
  Award,
  BellRing,
  CalendarClock,
  ClipboardList,
  CreditCard,
  MessageCircleReply,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@zihin/ui/lib/utils'
import type { NotificationType } from '@/lib/notifications/types'

/**
 * Tür → ikon eşlemesi.
 *
 * İkon TEK BAŞINA anlam taşımaz (CONVENTIONS §8): her satırda türün Türkçe
 * etiketi de yazılır, ikon `aria-hidden` kalır.
 */
const ICONS: Record<NotificationType, LucideIcon> = {
  review_due: RefreshCw,
  plan_reminder: CalendarClock,
  help_answered: MessageCircleReply,
  weekly_summary: ClipboardList,
  subscription_ending: CreditCard,
  badge_earned: Award,
  mock_published: BellRing,
}

export function NotificationIcon({
  type,
  className,
}: {
  type: NotificationType
  className?: string
}) {
  const Icon = ICONS[type] ?? BellRing
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full',
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}
