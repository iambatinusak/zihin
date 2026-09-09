'use client'

import { RadioGroup } from '@zihin/ui/radio-group'
import { section } from '@/lib/i18n/onboarding'
import { GRADES, type Grade } from '@/app/(auth)/onboarding/schemas'
import { OptionCard } from '../option-card'
import { StepShell } from '../step-shell'

type GradeStrings = {
  title: string
  description: string
  legend: string
  options: Record<Grade, string>
}

export function StepGrade({
  value,
  onChange,
  describedBy,
  invalid,
}: {
  value: Grade | null
  onChange: (grade: Grade) => void
  describedBy?: string
  invalid: boolean
}) {
  const s = section<GradeStrings>('onboarding.grade')

  return (
    <StepShell title={s.title} description={s.description}>
      <RadioGroup
        value={value ?? ''}
        onValueChange={(next) => onChange(next as Grade)}
        aria-label={s.legend}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="sm:grid-cols-2"
      >
        {GRADES.map((grade) => (
          <OptionCard key={grade} value={grade} label={s.options[grade] ?? grade} />
        ))}
      </RadioGroup>
    </StepShell>
  )
}
