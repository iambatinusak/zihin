import { Progress } from '@zihin/ui/progress'
import { section } from '@/lib/i18n/onboarding'

type ProgressStrings = { progressLabel: string; stepCounter: string }

/** Sihirbazın üst şeridi: kaçıncı adımda olduğunu hem metin hem çubukla söyler. */
export function WizardProgress({
  current,
  total,
  percent,
}: {
  current: number
  total: number
  percent: number
}) {
  const s = section<ProgressStrings>('onboarding')
  const counter = s.stepCounter
    .replace('{current}', String(current))
    .replace('{total}', String(total))

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{counter}</p>
      <Progress
        value={percent}
        aria-label={s.progressLabel}
        aria-valuetext={counter}
        className="h-1.5"
      />
    </div>
  )
}
