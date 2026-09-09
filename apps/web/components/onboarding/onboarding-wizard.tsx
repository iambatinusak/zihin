'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Card, CardContent } from '@zihin/ui/card'
import { section, t } from '@/lib/i18n/onboarding'
import { completeOnboarding, completeOnboardingStep } from '@/app/(auth)/onboarding/actions'
import {
  DEFAULT_STUDY_DAYS,
  OnboardingStepInputSchema,
  TOTAL_STEPS,
  type DailyMinutes,
  type Grade,
  type OnboardingRole,
  type OnboardingStepInput,
} from '@/app/(auth)/onboarding/schemas'
import {
  lastStepForRole,
  nextStep as computeNextStep,
  previousStep,
  progressPercent,
} from '@/app/(auth)/onboarding/step-machine'
import { WizardProgress } from './wizard-progress'
import { StepRole } from './steps/step-role'
import { StepExam, type ExamOption } from './steps/step-exam'
import { StepGrade } from './steps/step-grade'
import { StepDate } from './steps/step-date'
import { StepSchedule } from './steps/step-schedule'
import { StepPlacement } from './steps/step-placement'

const ERROR_ID = 'onboarding-hata'

export type WizardInitialValues = {
  role: OnboardingRole | null
  examId: string | null
  grade: Grade | null
  targetExamDate: string | null
  dailyMinutes: DailyMinutes
  studyDays: number[]
}

type WizardStrings = {
  title: string
  subtitle: string
  saving: string
  saveFailed: string
  resumeNotice: string
  finish: string
  finishing: string
}

/**
 * Altı adımlı başlangıç sihirbazı.
 *
 * Adım DEĞERLERİ istemcide tutulur ama İLERLEME sunucuda yaşar: her adım
 * `completeOnboardingStep` ile kaydedilir, sayfa yenilendiğinde sunucu
 * `initialStep`'i `profiles.onboarding_step` üzerinden yeniden hesaplar.
 */
export function OnboardingWizard({
  initialStep,
  initialValues,
  exams,
  rolePreselected,
  resumed,
  today,
}: {
  initialStep: number
  initialValues: WizardInitialValues
  exams: ExamOption[]
  rolePreselected: boolean
  resumed: boolean
  /** Sunucudan gelen "bugün" (YYYY-AA-GG); geçmiş tarih uyarısı buna göre verilir. */
  today: string
}) {
  const router = useRouter()
  const s = section<WizardStrings>('onboarding')

  const [step, setStep] = useState(initialStep)
  const [role, setRole] = useState<OnboardingRole | null>(initialValues.role)
  const [examId, setExamId] = useState<string | null>(initialValues.examId)
  const [grade, setGrade] = useState<Grade | null>(initialValues.grade)
  const [examDate, setExamDate] = useState(initialValues.targetExamDate ?? '')
  const [usedDefaultDate, setUsedDefaultDate] = useState(false)
  const [minutes, setMinutes] = useState<DailyMinutes>(initialValues.dailyMinutes)
  const [days, setDays] = useState<number[]>(
    initialValues.studyDays.length > 0 ? initialValues.studyDays : DEFAULT_STUDY_DAYS,
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveRole: OnboardingRole = role ?? 'student'
  const lastStep = lastStepForRole(effectiveRole)
  const back = previousStep(effectiveRole, step)
  const isPastDate = examDate !== '' && examDate < today

  /** O anki adımın action'a gidecek yükü; eksik seçim varsa null. */
  function payloadForStep(): OnboardingStepInput | null {
    switch (step) {
      case 1:
        return role ? { step: 1, role } : null
      case 2:
        return examId ? { step: 2, examId } : null
      case 3:
        return grade ? { step: 3, grade } : null
      case 4:
        return examDate ? { step: 4, targetExamDate: examDate } : null
      case 5:
        return { step: 5, dailyMinutes: minutes, studyDays: days }
      default:
        return null
    }
  }

  /** Eksik/geçersiz seçim için adıma özel Türkçe uyarı. */
  function localValidationMessage(): string | null {
    const payload = payloadForStep()
    if (!payload) {
      if (step === 1) return t('onboarding.role.required')
      if (step === 2) return t('onboarding.exam.required')
      if (step === 3) return t('onboarding.grade.required')
      if (step === 4) return t('onboarding.date.required')
      return s.saveFailed
    }

    const parsed = OnboardingStepInputSchema.safeParse(payload)
    if (parsed.success) return null
    if (step === 5 && days.length === 0) return t('onboarding.schedule.daysRequired')
    if (step === 4) return t('onboarding.date.invalid')
    return parsed.error.issues[0]?.message ?? s.saveFailed
  }

  async function handleNext() {
    const message = localValidationMessage()
    if (message) {
      setError(message)
      return
    }

    const payload = payloadForStep()
    if (!payload) return

    setPending(true)
    setError(null)

    const result = await completeOnboardingStep(payload)

    if (!result.ok) {
      setPending(false)
      setError(result.error.message)
      return
    }

    if (result.data.redirectTo) {
      router.replace(result.data.redirectTo)
      return
    }

    // Sınav seçildikten sonra tarih alanı, sınavın bilinen tarihiyle doldurulur.
    if (payload.step === 2 && examDate === '') {
      const chosen = exams.find((exam) => exam.id === payload.examId)
      if (chosen?.defaultExamDate) {
        setExamDate(chosen.defaultExamDate)
        setUsedDefaultDate(true)
      }
    }

    setPending(false)
    setStep(result.data.nextStep ?? lastStep)
  }

  async function handleFinish(startPlacement: boolean) {
    setPending(true)
    setError(null)

    const result = await completeOnboarding({ startPlacement })

    if (!result.ok) {
      setPending(false)
      setError(result.error.message)
      return
    }

    router.replace(result.data.redirectTo)
  }

  const placement = section<{ start: string; skip: string }>('onboarding.placement')

  return (
    <Card>
      <CardContent className="space-y-6 p-5 sm:p-6">
        <div className="space-y-3">
          <WizardProgress
            current={step}
            total={effectiveRole === 'parent' ? 1 : TOTAL_STEPS}
            percent={progressPercent(effectiveRole, step)}
          />
          {resumed && step > 1 ? (
            <p className="text-muted-foreground text-xs">{s.resumeNotice}</p>
          ) : null}
        </div>

        {step === 1 ? (
          <StepRole
            value={role}
            onChange={setRole}
            describedBy={error ? ERROR_ID : undefined}
            invalid={Boolean(error)}
            preselected={rolePreselected}
          />
        ) : null}

        {step === 2 ? (
          <StepExam
            exams={exams}
            value={examId}
            onChange={setExamId}
            describedBy={error ? ERROR_ID : undefined}
            invalid={Boolean(error)}
          />
        ) : null}

        {step === 3 ? (
          <StepGrade
            value={grade}
            onChange={setGrade}
            describedBy={error ? ERROR_ID : undefined}
            invalid={Boolean(error)}
          />
        ) : null}

        {step === 4 ? (
          <StepDate
            value={examDate}
            onChange={(next) => {
              setExamDate(next)
              setUsedDefaultDate(false)
            }}
            describedBy={error ? ERROR_ID : undefined}
            invalid={Boolean(error)}
            isPast={isPastDate}
            usedDefault={usedDefaultDate}
          />
        ) : null}

        {step === 5 ? (
          <StepSchedule
            minutes={minutes}
            days={days}
            onMinutesChange={setMinutes}
            onDaysChange={setDays}
            describedBy={error ? ERROR_ID : undefined}
            invalid={Boolean(error)}
          />
        ) : null}

        {step === 6 ? <StepPlacement /> : null}

        {error ? (
          <p
            id={ERROR_ID}
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => back !== null && setStep(back)}
            disabled={back === null || pending}
            className="sm:order-first"
          >
            <ArrowLeft aria-hidden="true" />
            {t('common.back')}
          </Button>

          {step === 6 ? (
            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
              <Button type="button" onClick={() => handleFinish(true)} disabled={pending}>
                {pending ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                {pending ? s.finishing : placement.start}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleFinish(false)}
                disabled={pending}
              >
                {placement.skip}
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={handleNext} disabled={pending}>
              {pending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
              {pending ? s.saving : t('common.continue')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
