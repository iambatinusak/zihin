import Link from 'next/link'
import { Button } from '@zihin/ui/button'
import { Badge } from '@zihin/ui/badge'
import { EmptyState } from '@/components/common/empty-state'
import { section, t } from '@/lib/i18n'
import type { SubscriptionSummary } from '@/lib/data/settings'

const s = section<{ subscription: Record<string, string> }>('settings')

/**
 * Salt okunur abonelik özeti. Satın alma akışı Faz 6'nın işi; buradan
 * yalnızca paket sayfasına yönlendirilir.
 */
export function SubscriptionCard({ subscription }: { subscription: SubscriptionSummary | null }) {
  if (!subscription) {
    return (
      <EmptyState
        title={t('settings.subscription.emptyTitle')}
        description={s.subscription.emptyDescription}
        action={
          <Button asChild>
            <Link href="/paketler">{s.subscription.emptyAction}</Link>
          </Button>
        }
      />
    )
  }

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground text-xs">{s.subscription.package}</dt>
        <dd className="mt-1 text-sm font-medium">{subscription.packageName}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">{s.subscription.endsAt}</dt>
        <dd className="mt-1 text-sm font-medium">{formatDate(subscription.endsAt)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">{s.subscription.daysLeft}</dt>
        <dd className="mt-1">
          <Badge variant={subscription.daysLeft <= 7 ? 'destructive' : 'secondary'}>
            {subscription.daysLeft <= 1
              ? s.subscription.lastDay
              : `${subscription.daysLeft} ${s.subscription.dayUnit}`}
          </Badge>
        </dd>
      </div>
    </dl>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
