import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getActiveExams, getProfile } from '@/lib/data'
import { section } from '@/lib/i18n'
import { ROLE_HOME } from '@/lib/roles'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  OnboardingWizard,
  type WizardInitialValues,
} from '@/components/onboarding/onboarding-wizard'
import {
  DAILY_MINUTES_OPTIONS,
  DEFAULT_STUDY_DAYS,
  ONBOARDING_ROLES,
  type DailyMinutes,
  type Grade,
  type OnboardingRole,
} from './schemas'
import { resolveResumeStep } from './step-machine'
import { turkeyDayKey } from '@/lib/time/turkey'

export const metadata: Metadata = {
  title: 'Başlangıç adımları',
}

/**
 * Sihirbazın giriş noktası.
 *
 * Guard burada: onboarding'i tamamlamış kullanıcı kendi ana sayfasına döner,
 * sihirbazı hiç görmeyen roller (öğretmen, editör, yönetici) de öyle.
 * (student) düzeni zaten eksik kullanıcıyı buraya yolluyor; o yönlendirme
 * burada tekrarlanmaz.
 */
export default async function OnboardingPage() {
  const user = await requireUser('/onboarding')

  if (user.onboardingCompleted) redirect(ROLE_HOME[user.role])
  if (!isOnboardingRole(user.role)) redirect(ROLE_HOME[user.role])

  const supabase = await createSupabaseServerClient()
  const [profile, exams] = await Promise.all([
    getProfile(supabase, user.id),
    getActiveExams(supabase),
  ])

  const role: OnboardingRole = user.role
  const savedStep = profile.onboarding_step
  const initialStep = resolveResumeStep(role, savedStep)

  const initialValues: WizardInitialValues = {
    role,
    examId: profile.exam_id,
    grade: (profile.grade as Grade | null) ?? null,
    targetExamDate: profile.target_exam_date,
    dailyMinutes: asDailyMinutes(profile.daily_minutes),
    studyDays: profile.study_days.length > 0 ? profile.study_days : DEFAULT_STUDY_DAYS,
  }

  const s = section<{ title: string; subtitle: string }>('onboarding')

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <p className="text-lg font-semibold tracking-tight">{s.title}</p>
        <p className="text-muted-foreground text-sm">{s.subtitle}</p>
      </div>

      <OnboardingWizard
        initialStep={initialStep}
        initialValues={initialValues}
        exams={exams.map((exam) => ({
          id: exam.id,
          name: exam.name,
          description: exam.description,
          defaultExamDate: exam.default_exam_date,
        }))}
        rolePreselected
        resumed={savedStep > 0}
        today={turkeyToday()}
      />
    </div>
  )
}

function isOnboardingRole(role: string): role is OnboardingRole {
  return (ONBOARDING_ROLES as readonly string[]).includes(role)
}

function asDailyMinutes(value: number): DailyMinutes {
  return (DAILY_MINUTES_OPTIONS as readonly number[]).includes(value) ? (value as DailyMinutes) : 60
}

/**
 * Türkiye saatiyle bugünün tarihi — tanım `lib/time/turkey.ts` içindedir
 * (`public.tr_today()` ile aynı kural). Offset burada TEKRAR YAZILMAZ.
 */
function turkeyToday(): string {
  return turkeyDayKey(Date.now())
}
