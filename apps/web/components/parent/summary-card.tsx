import type { ReactNode } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpenCheck,
  CalendarCheck,
  Minus,
  PlayCircle,
  Target,
  Timer,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { fill } from '@/lib/i18n'
import { splitHoursMinutes } from '@/lib/parent/format'
import { weekDelta, type WeekDelta } from '@/lib/parent/week'
import type { ParentWeeklySummary } from '@/lib/data/parent'
import { parentStrings } from './strings'

/**
 * Haftalık özet kutusu (spec §M12).
 *
 * Beş ölçü ve her birinin geçen haftaya göre değişimi. Ok TEK BAŞINA anlam
 * taşımaz: yönün yazılı karşılığı her zaman ekran okuyucuya gider ve yüzde
 * metin olarak da yazılır (CONVENTIONS §8).
 *
 * Kutuda hiçbir eylem bağlantısı yoktur; veli buradan bir içeriğe geçemez.
 */
export function WeeklySummaryCard({
  current,
  previous,
}: {
  current: ParentWeeklySummary
  previous: ParentWeeklySummary
}) {
  const s = parentStrings()

  const duration = splitHoursMinutes(current.studyMinutes)
  const durationText =
    duration.hours > 0
      ? fill(s.summary.hourMinute, { hours: duration.hours, minutes: duration.minutes })
      : `${duration.minutes} ${s.summary.minuteUnit}`

  const isEmpty =
    current.studySeconds === 0 &&
    current.questionsAnswered === 0 &&
    current.videosCompleted === 0 &&
    current.blocksPlanned === 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{s.summary.title}</CardTitle>
        {isEmpty ? <CardDescription>{s.summary.noData}</CardDescription> : null}
      </CardHeader>

      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            icon={<Timer aria-hidden="true" className="size-4" />}
            label={s.summary.studyTime}
            value={durationText}
            delta={weekDelta(current.studySeconds, previous.studySeconds)}
          />
          <Metric
            icon={<PlayCircle aria-hidden="true" className="size-4" />}
            label={s.summary.videos}
            value={`${current.videosCompleted}`}
            unit={s.summary.videoUnit}
            delta={weekDelta(current.videosCompleted, previous.videosCompleted)}
          />
          <Metric
            icon={<BookOpenCheck aria-hidden="true" className="size-4" />}
            label={s.summary.questions}
            value={`${current.questionsAnswered}`}
            unit={s.summary.questionUnit}
            delta={weekDelta(current.questionsAnswered, previous.questionsAnswered)}
          />
          <Metric
            icon={<Target aria-hidden="true" className="size-4" />}
            label={s.summary.accuracy}
            value={
              current.accuracyPercent === null
                ? s.summary.accuracyEmpty
                : `%${current.accuracyPercent}`
            }
            delta={
              current.accuracyPercent === null || previous.accuracyPercent === null
                ? null
                : weekDelta(current.accuracyPercent, previous.accuracyPercent)
            }
          />
          <Metric
            icon={<CalendarCheck aria-hidden="true" className="size-4" />}
            label={s.summary.blocks}
            value={
              current.blocksPlanned === 0
                ? s.summary.blocksEmpty
                : fill(s.summary.blocksValue, {
                    completed: current.blocksCompleted,
                    planned: current.blocksPlanned,
                  })
            }
            delta={weekDelta(current.blocksCompleted, previous.blocksCompleted)}
          />
        </dl>
      </CardContent>
    </Card>
  )
}

function Metric({
  icon,
  label,
  value,
  unit,
  delta,
}: {
  icon: ReactNode
  label: string
  value: string
  unit?: string
  delta: WeekDelta | null
}) {
  return (
    <div className="border-border rounded-lg border p-4">
      <dt className="text-muted-foreground flex items-center gap-2 text-sm">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 space-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-foreground text-2xl font-semibold tabular-nums">{value}</span>
          {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
        </p>
        <DeltaLine delta={delta} />
      </dd>
    </div>
  )
}

/** Değişim satırı: ok + yüzde + ekran okuyucuya tam cümle. */
function DeltaLine({ delta }: { delta: WeekDelta | null }) {
  const s = parentStrings()
  if (delta === null || delta.direction === 'none') return null

  const description =
    delta.direction === 'up'
      ? fill(s.delta.up, { value: delta.text ?? '' })
      : delta.direction === 'down'
        ? fill(s.delta.down, { value: delta.text ?? '' })
        : delta.direction === 'flat'
          ? s.delta.flat
          : s.delta.new

  const icon =
    delta.direction === 'up' ? (
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    ) : delta.direction === 'down' ? (
      <ArrowDownRight aria-hidden="true" className="size-3.5" />
    ) : (
      <Minus aria-hidden="true" className="size-3.5" />
    )

  const tone =
    delta.direction === 'up'
      ? 'text-mastery-strong'
      : delta.direction === 'down'
        ? 'text-mastery-weak'
        : 'text-muted-foreground'

  return (
    <p className={`flex items-center gap-1 text-xs ${tone}`}>
      {icon}
      <span aria-hidden="true">
        {delta.text ?? s.delta.newShort} {s.delta.caption}
      </span>
      <span className="sr-only">{description}</span>
    </p>
  )
}
