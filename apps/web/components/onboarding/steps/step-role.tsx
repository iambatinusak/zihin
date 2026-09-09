'use client'

import { GraduationCap, Users } from 'lucide-react'
import { RadioGroup } from '@zihin/ui/radio-group'
import { section } from '@/lib/i18n/onboarding'
import type { OnboardingRole } from '@/app/(auth)/onboarding/schemas'
import { OptionCard } from '../option-card'
import { StepShell } from '../step-shell'

type RoleStrings = {
  title: string
  description: string
  legend: string
  student: string
  studentHint: string
  parent: string
  parentHint: string
  preselected: string
}

export function StepRole({
  value,
  onChange,
  describedBy,
  invalid,
  preselected,
}: {
  value: OnboardingRole | null
  onChange: (role: OnboardingRole) => void
  describedBy?: string
  invalid: boolean
  preselected: boolean
}) {
  const s = section<RoleStrings>('onboarding.role')

  return (
    <StepShell title={s.title} description={s.description}>
      {preselected ? <p className="text-muted-foreground text-xs">{s.preselected}</p> : null}

      {/*
        Rol kayıt sırasında belirlenir; `profiles.role` istemciden yazılamaz
        (bkz. onboarding/actions.ts). Bu yüzden seçim burada salt okunurdur:
        değiştirilebilir göstermek, sunucunun reddedeceği bir vaat olurdu.
      */}
      <RadioGroup
        value={value ?? ''}
        onValueChange={(next) => onChange(next as OnboardingRole)}
        disabled={preselected}
        aria-label={s.legend}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      >
        <OptionCard
          value="student"
          label={s.student}
          hint={s.studentHint}
          icon={<GraduationCap aria-hidden="true" className="text-primary size-4" />}
        />
        <OptionCard
          value="parent"
          label={s.parent}
          hint={s.parentHint}
          icon={<Users aria-hidden="true" className="text-primary size-4" />}
        />
      </RadioGroup>
    </StepShell>
  )
}
