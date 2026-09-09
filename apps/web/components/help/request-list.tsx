import Link from 'next/link'
import { Badge } from '@zihin/ui/badge'
import { EmptyState } from '@/components/common/empty-state'
import { fill } from '@/lib/i18n'
import { helpStrings, statusLabel } from './strings'

/**
 * Öğrencinin soru geçmişi (spec §9.13).
 * Sunucu bileşeni: soru metni sunucuda kısaltılır, markdown ayrıntı sayfasında
 * basılır — liste satırında ham metnin ilk cümlesi yeter.
 */

export type RequestListItem = {
  id: string
  status: 'open' | 'answered' | 'closed'
  hasPendingMatches: boolean
  subjectName: string | null
  topicTitle: string | null
  preview: string
  createdAtLabel: string
  answeredAtLabel: string | null
}

export function RequestList({ items }: { items: RequestListItem[] }) {
  const s = helpStrings()

  if (items.length === 0) {
    return <EmptyState title={s.historyEmptyTitle} description={s.historyEmptyBody} />
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/soru-sor/${item.id}`}
            className="border-border hover:bg-accent/40 focus-visible:ring-ring block rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">
                {[item.subjectName, item.topicTitle].filter(Boolean).join(' · ')}
              </span>
              <Badge variant={item.status === 'answered' ? 'default' : 'secondary'}>
                {statusLabel(s, item.status, item.hasPendingMatches)}
              </Badge>
            </div>
            <p className="text-foreground mt-2 line-clamp-2 text-sm">{item.preview}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              {item.answeredAtLabel
                ? fill(s.answeredAt, { date: item.answeredAtLabel })
                : fill(s.askedAt, { date: item.createdAtLabel })}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
