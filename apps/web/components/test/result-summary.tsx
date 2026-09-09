import type { ReactNode } from 'react'
import { CheckCircle2, Circle, Clock, Percent, Target, XCircle } from 'lucide-react'
import { cn } from '@zihin/ui/lib/utils'
import type { TestSummary } from '@/lib/test-engine/session'
import { section } from '@/lib/i18n'
import type { TestStrings } from './strings'
import { averageMs, formatDurationMs, successPercent } from './result-state'

/**
 * Sonuç ekranının üst özet kartları (spec §9.9).
 *
 * Net `summarise` içinde hesaplanmıştır; burada yeniden hesaplanmaz. Renk tek
 * başına anlam taşımaz: her kartın metin etiketi ve simgesi vardır.
 */
export function ResultSummary({ summary }: { summary: TestSummary }) {
  const s = section<TestStrings>('test')
  const units = {
    hour: s.result.durationHour,
    minute: s.result.durationMinute,
    second: s.result.durationSecond,
  }

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <SummaryCard
        icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
        label={s.result.correct}
        value={String(summary.correct)}
        tone="strong"
      />
      <SummaryCard
        icon={<XCircle aria-hidden="true" className="size-4" />}
        label={s.result.wrong}
        value={String(summary.wrong)}
        tone="weak"
      />
      <SummaryCard
        icon={<Circle aria-hidden="true" className="size-4" />}
        label={s.result.blank}
        value={String(summary.blank)}
        tone="neutral"
      />
      <SummaryCard
        icon={<Target aria-hidden="true" className="size-4" />}
        label={s.result.net}
        value={summary.net.toFixed(2)}
        tone="primary"
      />
      <SummaryCard
        icon={<Percent aria-hidden="true" className="size-4" />}
        label={s.result.score}
        value={`%${successPercent(summary.correct, summary.total)}`}
        tone="primary"
      />
      <SummaryCard
        icon={<Clock aria-hidden="true" className="size-4" />}
        label={s.result.totalTime}
        value={formatDurationMs(summary.totalTimeMs, units)}
        hint={`${s.result.averageTime}: ${formatDurationMs(averageMs(summary.totalTimeMs, summary.total), units)}`}
        tone="neutral"
      />
    </dl>
  )
}

const TONES = {
  strong: 'text-mastery-strong',
  weak: 'text-mastery-weak',
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
} as const

function SummaryCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  tone: keyof typeof TONES
}) {
  return (
    <div className="border-border rounded-lg border p-3">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className={TONES[tone]}>{icon}</span>
        {label}
      </dt>
      <dd className={cn('mt-1 text-xl font-semibold tabular-nums', TONES[tone])}>{value}</dd>
      {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  )
}
