import Link from 'next/link'
import type { MasteryStatus } from '@zihin/core'
import { cn } from '@zihin/ui/lib/utils'
import type { MasterySubjectGroup, MasteryTopicEntry } from '@/lib/data/mastery'
import { topicHref } from '@/lib/panel/priority'
import { fill, t } from '@/lib/i18n'
import type { PanelStrings } from './strings'

/**
 * Konu ısı haritası — sunucu bileşeni.
 *
 * Renk tek başına anlam TAŞIMAZ (CONVENTIONS §8): her kutuda bandın Türkçe adı
 * ve 100 üzerinden puan yazılıdır, renk yalnızca aynı bilgiyi hızlı taranır
 * kılar. Kutular birer bağlantı olduğu için ızgara klavyeyle doğal olarak
 * gezilebilir; ipucu balonu `group-focus-within` ile odakta da açılır, yani
 * yalnızca fareyle erişilebilen bir bilgi yoktur.
 */

/** Bant → arka plan tonu ve sol şerit. Ton düşük tutulur ki metin okunur kalsın. */
const STATUS_CELL: Record<MasteryStatus, string> = {
  unknown: 'border-l-mastery-unknown bg-mastery-unknown/10',
  weak: 'border-l-mastery-weak bg-mastery-weak/10',
  medium: 'border-l-mastery-medium bg-mastery-medium/10',
  strong: 'border-l-mastery-strong bg-mastery-strong/10',
}

const STATUS_DOT: Record<MasteryStatus, string> = {
  unknown: 'bg-mastery-unknown',
  weak: 'bg-mastery-weak',
  medium: 'bg-mastery-medium',
  strong: 'bg-mastery-strong',
}

type TopicHeatMapProps = {
  subject: MasterySubjectGroup
  /** Ünite kimliğinden slug'a — konu bağlantısı üç slug ister. */
  unitSlugs: Record<string, string>
  strings: PanelStrings
}

export function TopicHeatMap({ subject, unitSlugs, strings }: TopicHeatMapProps) {
  return (
    <div className="space-y-6">
      {subject.units.map((unit) => (
        <section key={unit.unitId} aria-labelledby={`unit-${unit.unitId}`}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id={`unit-${unit.unitId}`} className="text-foreground text-sm font-semibold">
              {unit.name}
            </h3>
            <p className="text-muted-foreground text-xs">
              {t('mastery.unitAverage')}:{' '}
              <span className="font-medium tabular-nums">{unit.averageMastery}</span>
            </p>
          </div>

          <ul
            aria-label={`${unit.name} — ${strings.unitTopicsLabel}`}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          >
            {unit.topics.map((topic) => (
              <HeatCell
                key={topic.topicId}
                topic={topic}
                href={topicHref(subject.slug, unitSlugs[unit.unitId] ?? null, topic.slug)}
                strings={strings}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

type HeatCellProps = {
  topic: MasteryTopicEntry
  href: string | null
  strings: PanelStrings
}

function HeatCell({ topic, href, strings }: HeatCellProps) {
  const statusLabel = t(`mastery.${topic.status}`)
  const descriptionId = `heat-${topic.topicId}`
  // Ölçülmemiş konuda puan gösterilmez: 35 nötr bir ön seldir, kullanıcının
  // kazandığı bir puan değil. Yerine tire konur, durum sözcüğü anlamı taşır.
  const measured = topic.status !== 'unknown'
  const score = measured ? String(topic.mastery) : '—'

  const body = (
    <>
      <span className="text-foreground line-clamp-2 text-xs font-medium leading-snug">
        {topic.title}
      </span>
      <span className="mt-2 flex items-center justify-between gap-1">
        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
          <span
            aria-hidden="true"
            className={cn('size-2 rounded-full', STATUS_DOT[topic.status])}
          />
          {statusLabel}
        </span>
        <span className="text-foreground text-xs font-semibold tabular-nums">{score}</span>
      </span>
    </>
  )

  const shell = cn(
    'border-border flex h-full flex-col rounded-md border border-l-4 p-2 text-left transition-colors',
    'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
    STATUS_CELL[topic.status],
  )

  return (
    <li className="group relative">
      {href ? (
        <Link
          href={href}
          aria-describedby={descriptionId}
          className={cn(shell, 'hover:brightness-95 dark:hover:brightness-110')}
        >
          {body}
        </Link>
      ) : (
        <div tabIndex={0} aria-describedby={descriptionId} className={shell}>
          {body}
        </div>
      )}

      <span
        id={descriptionId}
        role="tooltip"
        className="border-border bg-popover text-popover-foreground pointer-events-none absolute left-0 top-full z-20 mt-1 w-56 rounded-md border p-2 text-xs opacity-0 shadow-md transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <span className="block font-medium">{topic.title}</span>
        <span className="text-muted-foreground mt-1 block">
          {measured
            ? fill(strings.cellDescription, {
                score: topic.mastery,
                status: statusLabel,
                attempts: topic.attemptsCount,
              })
            : strings.notMeasuredYet}
        </span>
      </span>
    </li>
  )
}
