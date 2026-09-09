import Link from 'next/link'
import { buttonVariants } from '@zihin/ui/button'
import { cn } from '@zihin/ui/lib/utils'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { NotificationList } from '@/components/notifications/notification-list'
import { notificationStrings } from '@/components/notifications/strings'
import type { NotificationItemView } from '@/components/notifications/notification-item'
import { requireUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { countNotificationsByType, listNotifications } from '@/lib/data/notifications'
import {
  FALLBACK_NOTIFICATION_TYPE,
  isNotificationType,
  NOTIFICATION_TYPES,
} from '@/lib/notifications/types'
import { formatRelativeTime, relativeTime } from '@/lib/notifications/format'
import { parseTypeFilter } from './schemas'

/**
 * Bildirim listesi (spec §M16, ekran §9.x).
 *
 * ── ROTA GRUBU NOTU ────────────────────────────────────────────────────────
 * Sayfa `(student)` grubunda yaşıyor çünkü Next.js aynı yolu (`/bildirimler`)
 * iki grupta tanımlamaya izin vermez. Grubun düzeni öğrenci zorunlu kılar; veli
 * ve öğretmen bildirimlerini üst çubuktaki zil panelinden okur ve zil onlara bu
 * sayfanın bağlantısını göstermez (bkz. `components/notifications/
 * notification-bell.tsx`). Rol-bağımsız bir kabuk açılırsa sayfa oraya taşınır;
 * içerik `requireUser()` ile zaten rol beklemiyor.
 *
 * Filtre sunucuda çözülür ve doğrulanır: `?tur=` değeri tür listesinde yoksa
 * yok sayılır, sorguya ham girdi olarak geçmez.
 */

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Bildirimler' }

const PAGE_LIMIT = 50

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tur?: string }>
}) {
  const s = notificationStrings()
  const user = await requireUser('/bildirimler')
  const supabase = await createSupabaseServerClient()

  const params = await searchParams
  const activeType = parseTypeFilter(params.tur)

  const rows = await listNotifications(supabase, user.id, {
    limit: PAGE_LIMIT,
    ...(activeType ? { types: [activeType] } : {}),
  })
  const counts = await countNotificationsByType(supabase, user.id)

  const now = new Date()
  const items: NotificationItemView[] = rows.map((row) => ({
    id: row.id,
    type: isNotificationType(row.type) ? row.type : FALLBACK_NOTIFICATION_TYPE,
    title: row.title,
    body: row.body,
    link: row.link,
    read: row.read_at !== null,
    timeLabel: formatRelativeTime(relativeTime(row.created_at, now), s.time),
  }))

  const hasUnread = items.some((item) => !item.read)
  const totalCount = [...counts.values()].reduce((sum, value) => sum + value, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.title}
        description={s.description}
        actions={
          <Link href="/ayarlar" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {s.prefsLink}
          </Link>
        }
      />

      <nav aria-label={s.filterLabel}>
        <ul className="flex flex-wrap gap-2">
          <FilterChip
            label={s.filterAll}
            count={totalCount}
            href="/bildirimler"
            active={!activeType}
          />
          {NOTIFICATION_TYPES.filter((type) => (counts.get(type) ?? 0) > 0).map((type) => (
            <FilterChip
              key={type}
              label={s.types[type] ?? type}
              count={counts.get(type) ?? 0}
              href={`/bildirimler?tur=${type}`}
              active={activeType === type}
            />
          ))}
        </ul>
      </nav>

      {items.length === 0 ? (
        <EmptyState
          title={activeType ? s.emptyFilterTitle : s.emptyTitle}
          description={activeType ? s.emptyFilterBody : s.emptyBody}
          action={
            activeType ? (
              <Link href="/bildirimler" className={buttonVariants({ variant: 'outline' })}>
                {s.filterAll}
              </Link>
            ) : null
          }
        />
      ) : (
        <NotificationList items={items} strings={s} hasUnread={hasUnread} />
      )}

      <p className="text-muted-foreground text-sm">{s.prefsHint}</p>
    </div>
  )
}

function FilterChip({
  label,
  count,
  href,
  active,
}: {
  label: string
  count: number
  href: string
  active: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'border-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
          active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        {label}
        <span className={cn('text-xs', active ? 'opacity-80' : 'opacity-70')}>{count}</span>
      </Link>
    </li>
  )
}
