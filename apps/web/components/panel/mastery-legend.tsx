import type { MasteryStatus } from '@zihin/core'
import { cn } from '@zihin/ui/lib/utils'
import { t } from '@/lib/i18n'
import { MASTERY_STATUSES } from '@/lib/panel/summaries'
import type { PanelStrings } from './strings'

const DOT: Record<MasteryStatus, string> = {
  unknown: 'bg-mastery-unknown',
  weak: 'bg-mastery-weak',
  medium: 'bg-mastery-medium',
  strong: 'bg-mastery-strong',
}

/** Renk anahtarı. Her bandın yanında Türkçe adı ve kaç konuya denk geldiği yazar. */
export function MasteryLegend({
  counts,
  strings,
}: {
  counts: Record<MasteryStatus, number>
  strings: PanelStrings
}) {
  return (
    <ul aria-label={strings.legendLabel} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {MASTERY_STATUSES.map((status) => (
        <li key={status} className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span aria-hidden="true" className={cn('size-2.5 rounded-full', DOT[status])} />
          <span className="text-foreground">{t(`mastery.${status}`)}</span>
          <span className="tabular-nums">({counts[status]})</span>
        </li>
      ))}
    </ul>
  )
}
