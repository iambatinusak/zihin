'use client'

import { RadioGroup } from '@zihin/ui/radio-group'
import { section } from '@/lib/i18n/onboarding'
import { OptionCard } from '../option-card'
import { StepShell } from '../step-shell'

/** Sihirbazın ihtiyaç duyduğu asgari sınav bilgisi. */
export type ExamOption = {
  id: string
  name: string
  description: string | null
  defaultExamDate: string | null
}

type ExamStrings = { title: string; description: string; legend: string; empty: string }

export function StepExam({
  exams,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  exams: ExamOption[]
  value: string | null
  onChange: (examId: string) => void
  describedBy?: string
  invalid: boolean
}) {
  const s = section<ExamStrings>('onboarding.exam')

  return (
    <StepShell title={s.title} description={s.description}>
      {exams.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          {s.empty}
        </p>
      ) : (
        <RadioGroup
          value={value ?? ''}
          onValueChange={onChange}
          aria-label={s.legend}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          {exams.map((exam) => (
            <OptionCard
              key={exam.id}
              value={exam.id}
              label={exam.name}
              hint={exam.description ?? undefined}
            />
          ))}
        </RadioGroup>
      )}
    </StepShell>
  )
}
