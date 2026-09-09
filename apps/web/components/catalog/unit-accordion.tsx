import Link from 'next/link'
import { ChevronRight, Clock, Lock } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@zihin/ui/accordion'
import { Badge } from '@zihin/ui/badge'
import { MasteryBadge } from '@/components/common/mastery-badge'
import { EmptyState } from '@/components/common/empty-state'
import type { UnitWithTopicItems } from '@/lib/data'
import { section } from '@/lib/i18n'
import { isContentLocked } from './progress'
import type { CatalogStrings } from './strings'

type UnitAccordionProps = {
  subjectSlug: string
  units: UnitWithTopicItems[]
  hasSubscription: boolean
}

/**
 * Dersin üniteleri. İlk ünite açık gelir; akordiyon çoklu seçimlidir, böylece
 * öğrenci iki üniteyi yan yana karşılaştırabilir.
 *
 * Radix akordiyonu istemci bileşenidir ama içeriği sunucuda üretilir; bu dosya
 * `'use client'` taşımaz.
 */
export function UnitAccordion({ subjectSlug, units, hasSubscription }: UnitAccordionProps) {
  const s = section<CatalogStrings>('catalog')
  const first = units[0]

  return (
    <Accordion
      type="multiple"
      defaultValue={first ? [first.id] : []}
      className="border-border divide-border divide-y rounded-lg border"
    >
      {units.map((unit, index) => {
        const totalMinutes = unit.topics.reduce((sum, topic) => sum + topic.estimated_minutes, 0)

        return (
          <AccordionItem key={unit.id} value={unit.id} className="border-b-0 px-4">
            <AccordionTrigger>
              <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                <span className="text-foreground font-medium">
                  <span className="text-muted-foreground tabular-nums">{index + 1}.</span>{' '}
                  {unit.name}
                </span>
                <span className="text-muted-foreground text-xs font-normal">
                  {unit.topics.length} {s.unitTopicCount} · {totalMinutes} {s.unitMinutes}
                </span>
              </span>
            </AccordionTrigger>

            <AccordionContent className="pb-4">
              {unit.topics.length === 0 ? (
                <EmptyState title={s.noTopicsTitle} className="py-8" />
              ) : (
                <ul className="space-y-1">
                  {unit.topics.map((topic) => {
                    const locked = isContentLocked({
                      hasSubscription,
                      hasContent: topic.hasContent,
                      hasFreePreview: topic.hasFreePreview,
                    })

                    return (
                      <li key={topic.id}>
                        <Link
                          href={`/dersler/${subjectSlug}/${unit.slug}/${topic.slug}`}
                          className="hover:bg-muted/60 focus-visible:ring-ring group flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="text-foreground block truncate text-sm font-medium">
                              {topic.title}
                            </span>
                            <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                              <Clock aria-hidden="true" className="size-3" />
                              {topic.estimated_minutes} {s.unitMinutes}
                            </span>
                          </span>

                          {locked ? (
                            <Badge variant="outline" className="gap-1" title={s.lockedHint}>
                              <Lock aria-hidden="true" className="size-3" />
                              {s.locked}
                            </Badge>
                          ) : null}

                          <MasteryBadge
                            status={topic.mastery?.status ?? 'unknown'}
                            className="shrink-0"
                          />

                          <ChevronRight
                            aria-hidden="true"
                            className="text-muted-foreground size-4 shrink-0"
                          />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
