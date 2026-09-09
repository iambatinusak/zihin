'use client'

import { Check } from 'lucide-react'
import { section } from '@/lib/i18n/onboarding'
import { StepShell } from '../step-shell'

type PlacementStrings = {
  title: string
  description: string
  bullet1: string
  bullet2: string
  bullet3: string
}

export function StepPlacement() {
  const s = section<PlacementStrings>('onboarding.placement')

  return (
    <StepShell title={s.title} description={s.description}>
      <ul className="space-y-2">
        {[s.bullet1, s.bullet2, s.bullet3].map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm">
            <Check aria-hidden="true" className="text-mastery-strong mt-0.5 size-4 shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </StepShell>
  )
}
