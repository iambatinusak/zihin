'use client'

import { Checkbox } from '@zihin/ui/checkbox'
import { Label } from '@zihin/ui/label'
import { RadioGroup } from '@zihin/ui/radio-group'
import { section } from '@/lib/i18n/onboarding'
import { DAILY_MINUTES_OPTIONS, type DailyMinutes } from '@/app/(auth)/onboarding/schemas'
import { OptionCard } from '../option-card'
import { StepShell } from '../step-shell'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const

type ScheduleStrings = {
  title: string
  description: string
  minutesLegend: string
  daysLegend: string
  daysHint: string
  minutes: Record<string, string>
  days: Record<string, string>
  daysShort: Record<string, string>
}

export function StepSchedule({
  minutes,
  days,
  onMinutesChange,
  onDaysChange,
  describedBy,
  invalid,
}: {
  minutes: DailyMinutes
  days: number[]
  onMinutesChange: (minutes: DailyMinutes) => void
  onDaysChange: (days: number[]) => void
  describedBy?: string
  invalid: boolean
}) {
  const s = section<ScheduleStrings>('onboarding.schedule')
  const daysHintId = 'calisma-gunleri-ipucu'

  function toggleDay(day: number, checked: boolean) {
    const next = checked ? [...days, day] : days.filter((value) => value !== day)
    onDaysChange(next.sort((a, b) => a - b))
  }

  return (
    <StepShell title={s.title} description={s.description}>
      <RadioGroup
        value={String(minutes)}
        onValueChange={(next) => onMinutesChange(Number(next) as DailyMinutes)}
        aria-label={s.minutesLegend}
        className="sm:grid-cols-2"
      >
        {DAILY_MINUTES_OPTIONS.map((option) => (
          <OptionCard
            key={option}
            value={String(option)}
            label={s.minutes[String(option)] ?? `${option} dakika`}
          />
        ))}
      </RadioGroup>

      <fieldset
        className="space-y-3"
        aria-invalid={invalid}
        aria-describedby={[describedBy, daysHintId].filter(Boolean).join(' ') || undefined}
      >
        <legend className="text-sm font-medium">{s.daysLegend}</legend>
        <div className="flex flex-wrap gap-2">
          {WEEK_DAYS.map((day) => {
            const id = `calisma-gunu-${day}`
            const checked = days.includes(day)
            return (
              <Label
                key={day}
                htmlFor={id}
                className="border-border bg-card has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(state) => toggleDay(day, state === true)}
                />
                <span aria-hidden="true">{s.daysShort[String(day)] ?? String(day)}</span>
                <span className="sr-only">{s.days[String(day)] ?? String(day)}</span>
              </Label>
            )
          })}
        </div>
        <p id={daysHintId} className="text-muted-foreground text-xs">
          {s.daysHint}
        </p>
      </fieldset>
    </StepShell>
  )
}
