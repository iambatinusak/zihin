'use client'

import { AlertTriangle } from 'lucide-react'
import { Input } from '@zihin/ui/input'
import { Label } from '@zihin/ui/label'
import { section } from '@/lib/i18n/onboarding'
import { StepShell } from '../step-shell'

type DateStrings = {
  title: string
  description: string
  label: string
  hint: string
  defaultApplied: string
  pastWarning: string
}

export function StepDate({
  value,
  onChange,
  describedBy,
  invalid,
  isPast,
  usedDefault,
}: {
  value: string
  onChange: (date: string) => void
  describedBy?: string
  invalid: boolean
  isPast: boolean
  usedDefault: boolean
}) {
  const s = section<DateStrings>('onboarding.date')
  const hintId = 'sinav-tarihi-ipucu'
  const warningId = 'sinav-tarihi-uyari'

  const described = [describedBy, hintId, isPast ? warningId : null].filter(Boolean).join(' ')

  return (
    <StepShell title={s.title} description={s.description}>
      <div className="space-y-2">
        <Label htmlFor="sinav-tarihi">{s.label}</Label>
        <Input
          id="sinav-tarihi"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={described || undefined}
          className="w-full"
        />
        <p id={hintId} className="text-muted-foreground text-xs">
          {usedDefault ? `${s.defaultApplied} ${s.hint}` : s.hint}
        </p>

        {/* Geçmiş tarih engellenmez, yalnızca uyarılır: plan üreticisi bu durumu ele alır. */}
        {isPast ? (
          <p
            id={warningId}
            className="border-border bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-md border p-3 text-xs"
          >
            <AlertTriangle
              aria-hidden="true"
              className="text-mastery-medium mt-0.5 size-4 shrink-0"
            />
            {s.pastWarning}
          </p>
        ) : null}
      </div>
    </StepShell>
  )
}
