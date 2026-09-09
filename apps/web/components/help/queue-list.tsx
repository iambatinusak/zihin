import Link from 'next/link'
import { Badge } from '@zihin/ui/badge'
import { EmptyState } from '@/components/common/empty-state'
import { fill } from '@/lib/i18n'
import { helpStrings } from './strings'

/**
 * Öğretmen kuyruğu (spec §9.13): en eski soru en üstte.
 *
 * Öğrenci burada GÖRÜNEN adıyla listelenir. Gerçek ad, ancak öğrenci takma ad
 * seçmediyse ve profilinde tam adı varsa görünür — bu ayrım veri katmanında
 * yapılır (bkz. lib/data/help.ts → getDisplayNames).
 */

export type QueueItem = {
  id: string
  studentName: string
  subjectName: string | null
  topicTitle: string | null
  preview: string
  waitingLabel: string
  hasImage: boolean
}

export function QueueList({ items }: { items: QueueItem[] }) {
  const s = helpStrings()

  if (items.length === 0) {
    return <EmptyState title={s.teacherQueueEmptyTitle} description={s.teacherQueueEmptyBody} />
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/ogretmen/sorular/${item.id}`}
            className="border-border hover:bg-accent/40 focus-visible:ring-ring block rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-foreground text-sm font-medium">{item.studentName}</span>
              <span className="text-muted-foreground text-xs">
                {fill(s.teacherWaiting, { duration: item.waitingLabel })}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {[item.subjectName, item.topicTitle].filter(Boolean).join(' · ')}
            </p>
            <p className="text-foreground mt-2 line-clamp-2 text-sm">{item.preview}</p>
            {item.hasImage ? (
              <Badge variant="outline" className="mt-2">
                {s.imageLabel}
              </Badge>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
