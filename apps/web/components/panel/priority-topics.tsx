import Link from 'next/link'
import { Layers, PlayCircle } from 'lucide-react'
import { buttonVariants } from '@zihin/ui/button'
import { MasteryBadge } from '@/components/common/mastery-badge'
import { EmptyState } from '@/components/common/empty-state'
import { StartTestButton } from '@/components/test/start-test-button'
import type { PriorityTopicRow } from '@/lib/data/panel'
import { cardsHref } from '@/lib/panel/priority'
import { fill } from '@/lib/i18n'
import type { PanelStrings } from './strings'

/**
 * "Öncelikli 5 konu" kartı — sunucu bileşeni.
 *
 * Hızlı pratik düğmesi yeniden YAZILMAZ: test motorunun `StartTestButton`'ı
 * `{ type: 'quick_practice', topicId }` girdisiyle olduğu gibi kullanılır.
 * Oturumu açan, yarım kalanı sürdüren ve hataları gösteren mantık orada.
 */
export function PriorityTopics({
  rows,
  strings,
}: {
  rows: PriorityTopicRow[]
  strings: PanelStrings
}) {
  if (rows.length === 0) {
    return <EmptyState title={strings.priorityTitle} description={strings.priorityEmpty} />
  }

  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.topicId} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">{row.title}</p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{row.subjectName}</p>
          </div>

          <div className="shrink-0">
            <MasteryBadge mastery={row.mastery} attempts={row.attemptsCount} showScore />
          </div>

          <div
            aria-label={fill(strings.priorityRowLabel, { topic: row.title })}
            className="flex flex-wrap items-center gap-2"
          >
            <WatchAction row={row} strings={strings} />

            <StartTestButton
              input={{ type: 'quick_practice', topicId: row.topicId }}
              variant="secondary"
              size="sm"
            >
              {strings.actionPractice}
            </StartTestButton>

            <Link
              href={cardsHref(row.topicId)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Layers aria-hidden="true" className="size-4" />
              {strings.actionCards}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * Konunun ilk videosu varsa doğrudan oynatıcıya, yoksa konu sayfasına gider.
 * İkisi de yoksa (slug üretilemedi) düğme hiç çizilmez — kırık bağlantı olmaz.
 */
function WatchAction({ row, strings }: { row: PriorityTopicRow; strings: PanelStrings }) {
  if (row.firstVideoId) {
    return (
      <Link
        href={`/video/${row.firstVideoId}`}
        className={buttonVariants({ variant: 'default', size: 'sm' })}
      >
        <PlayCircle aria-hidden="true" className="size-4" />
        {strings.actionWatch}
      </Link>
    )
  }

  if (row.topicHref) {
    return (
      <Link href={row.topicHref} className={buttonVariants({ variant: 'default', size: 'sm' })}>
        {strings.actionOpenTopic}
      </Link>
    )
  }

  return null
}
