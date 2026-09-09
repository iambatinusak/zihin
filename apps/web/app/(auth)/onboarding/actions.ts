'use server'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { TablesUpdate } from '@zihin/db/types'
import {
  CompleteOnboardingSchema,
  OnboardingStepInputSchema,
  TOTAL_STEPS,
  type OnboardingRole,
  type OnboardingStepInput,
} from './schemas'
import { homeForRole, nextStep } from './step-machine'

/**
 * Onboarding sihirbazının mutasyonları.
 *
 * İlerleme HER adımdan sonra `profiles.onboarding_step` sütununa yazılır;
 * tek doğru kaynak veritabanıdır. Sayfa yenilense de, kullanıcı başka bir
 * cihazdan dönse de sihirbaz kaldığı yerden devam eder (spec §M1 kabul kriteri).
 */

/** Sihirbazı yürütebilen roller. Diğer roller onboarding görmez. */
const WIZARD_ROLES = ['student', 'parent'] as const

export type StepResult = {
  /** Kaydedilen adım (tamamlanmış adım sayısı olarak profile yazıldı). */
  savedStep: number
  /** Sıradaki adım; sihirbaz bittiyse null. */
  nextStep: number | null
  /** Sihirbaz bu adımda bittiyse gidilecek sayfa. */
  redirectTo: string | null
}

/**
 * Tek bir adımı kaydeder ve ilerlemeyi işler.
 * Girdi ayrık birlik olduğu için `step` daraltıldığında yalnızca o adımın
 * alanları görünür — yanlış adıma yanlış alan yazmak derlenmez.
 */
export const completeOnboardingStep = action(
  OnboardingStepInputSchema,
  async (input: OnboardingStepInput): Promise<StepResult> => {
    const user = await assertRole([...WIZARD_ROLES])
    const supabase = await createSupabaseServerClient()

    /*
     * GÜVENLİK: `profiles.role` bu action'dan YAZILMAZ.
     *
     * Rol kayıt sırasında `handle_new_user` trigger'ıyla belirlenir ve
     * `protect_profile_fields` trigger'ı istemci kaynaklı her rol değişikliğini
     * sessizce geri alır (0011_rls_policies.sql). Buraya `patch.role` koymak
     * hem yetki yükseltme yüzeyi açar hem de yalancı bir başarı üretirdi:
     * güncelleme hatasız döner ama rol değişmez, sihirbaz ise yeni role göre
     * akıp kullanıcıyı erişemeyeceği bir sayfaya yollardı.
     *
     * Adım 1 bu yüzden bir ONAY adımıdır: gelen rol oturumdaki rolle
     * eşleşmiyorsa istek reddedilir ve kullanıcıya ne yapması gerektiği söylenir.
     */
    const sessionRole = asWizardRole(user.role) ?? 'student'

    if (input.step === 1 && input.role !== sessionRole) {
      throw new AppError(
        'forbidden',
        'Rolünüz kayıt sırasında belirlenir ve buradan değiştirilemez. ' +
          'Farklı bir rolle devam etmek için o rolle yeni bir hesap açın.',
      )
    }

    const role: OnboardingRole = sessionRole

    const patch: TablesUpdate<'profiles'> = { onboarding_step: input.step }

    switch (input.step) {
      case 1:
        // Rol yazılmaz (yukarıya bakın). Tek iş, KVKK rızasının kaydedildiğini
        // garanti etmek: kayıt anındaki yazma service-role anahtarı gerektirir
        // ve anahtar yoksa sessizce atlanır. Kullanıcı buraya kendi oturumuyla
        // geldiği için rıza zamanı burada geri doldurulabilir.
        await backfillKvkkConsent(supabase, user.id, patch)
        break
      case 2:
        await assertExamExists(supabase, input.examId)
        patch.exam_id = input.examId
        break
      case 3:
        patch.grade = input.grade
        break
      case 4:
        patch.target_exam_date = input.targetExamDate
        break
      case 5:
        patch.daily_minutes = input.dailyMinutes
        patch.study_days = [...input.studyDays].sort((a, b) => a - b)
        break
    }

    const upcoming = nextStep(role, input.step)

    // Veli akışı rol adımında biter; sihirbazı yarım bırakmamak için burada kapatılır.
    if (upcoming === null) {
      patch.onboarding_completed = true
      patch.onboarding_step = TOTAL_STEPS
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) throw new AppError('internal', 'Bilgileriniz kaydedilemedi. Lütfen tekrar deneyin.')

    return {
      savedStep: input.step,
      nextStep: upcoming,
      redirectTo: upcoming === null ? homeForRole(role) : null,
    }
  },
)

/**
 * 6. adım: sihirbazı kapatır.
 *
 * `startPlacement` true ise kullanıcı `/seviye-tespit` sayfasına yönlendirilir;
 * sınav oturumu orada, `startPlacementTest` action'ı ile açılır (spec §M7).
 */
export const completeOnboarding = action(CompleteOnboardingSchema, async ({ startPlacement }) => {
  const user = await assertRole([...WIZARD_ROLES])
  const supabase = await createSupabaseServerClient()
  const role = asWizardRole(user.role) ?? 'student'

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true, onboarding_step: TOTAL_STEPS })
    .eq('id', user.id)

  if (error) throw new AppError('internal', 'Kayıt tamamlanamadı. Lütfen tekrar deneyin.')

  return { redirectTo: homeForRole(role, startPlacement) }
})

/**
 * Seçilen sınavın gerçekten aktif olduğunu doğrular; istemciden gelen uuid'e
 * körlemesine güvenilmez.
 */
async function assertExamExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  examId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('exams')
    .select('id')
    .eq('id', examId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Sınav doğrulanamadı.')
  if (!data) throw new AppError('not_found', 'Seçtiğiniz sınav bulunamadı.')
}

/**
 * `kvkk_consent_at` boşsa şimdiyi yazar.
 *
 * Rıza kayıt formunda zorunlu (bkz. `kvkkConsentSchema`) ama o anda oturum
 * yoktur; yazma service-role anahtarına düşer ve anahtar tanımsızsa atlanır.
 * Rızanın kaydı hukuken yük taşıdığı için burada ikinci bir şans verilir.
 * Kolon `protect_profile_fields` tarafından korunmuyor; kullanıcı kendi
 * satırında bu alanı yazabilir.
 */
async function backfillKvkkConsent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  patch: TablesUpdate<'profiles'>,
): Promise<void> {
  const { data } = await supabase
    .from('profiles')
    .select('kvkk_consent_at')
    .eq('id', userId)
    .maybeSingle()

  if (data && data.kvkk_consent_at === null) {
    patch.kvkk_consent_at = new Date().toISOString()
  }
}

function asWizardRole(role: string): OnboardingRole | null {
  return (WIZARD_ROLES as readonly string[]).includes(role) ? (role as OnboardingRole) : null
}
