import Link from 'next/link'
import { Target } from 'lucide-react'
import type { MasteryStatus } from '@zihin/core'
import { MasteryBadge } from '@/components/common/mastery-badge'
import { PanelCard, PanelHint } from './panel-card'
import { dashboardStrings } from './strings'

export type PriorityTopicItem = {
  topicId: string
  title: string
  mastery: number
  status: MasteryStatus
  /** Konu sayfası; slug çözülemediyse null (bağlantı yerine düz metin). */
  href: string | null
}

/**
 * Öncelikli konular kutusu.
 *
 * Sıralamayı core'daki `rankPriorityTopics` yapar; burada yalnızca ilk üçü
 * gösterilir. Yetkinlik bandı renk ve METİN birlikte verilir — renk tek başına
 * anlam taşımaz (CONVENTIONS §8).
 */
export function PriorityTopicsCard({ topics }: { topics: PriorityTopicItem[] }) {
  const s = dashboardStrings()

  return (
    <PanelCard
      title={s.priorityTitle}
      icon={<Target aria-hidden="true" className="size-4" />}
      link={{ href: '/panel', label: s.goLessons }}
    >
      {topics.length === 0 ? (
        <>
          <p className="text-foreground text-sm font-medium">{s.priorityEmpty}</p>
          <PanelHint>{s.priorityEmptyHint}</PanelHint>
        </>
      ) : (
        <ol className="space-y-2">
          {topics.map((topic, index) => (
            <li key={topic.topicId} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-muted-foreground w-4 shrink-0 text-xs tabular-nums">
                  {index + 1}.
                </span>
                {topic.href ? (
                  <Link
                    href={topic.href}
                    className="hover:text-primary focus-visible:ring-ring truncate rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
                  >
                    {topic.title}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium">{topic.title}</span>
                )}
              </span>
              <MasteryBadge status={topic.status} className="shrink-0" />
            </li>
          ))}
        </ol>
      )}
    </PanelCard>
  )
}
