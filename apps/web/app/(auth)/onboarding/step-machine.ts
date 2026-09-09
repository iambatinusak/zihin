import { ROLE_HOME } from '@/lib/roles'
import { TOTAL_STEPS, type OnboardingRole } from './schemas'

/**
 * Sihirbazın saf gezinme mantığı. Ne React'i ne Supabase'i tanır; girdi alır,
 * hangi adımın gösterileceğini söyler. Testi `step-machine.test.ts` içindedir.
 *
 * Adım numaralandırması:
 *   `profiles.onboarding_step` = TAMAMLANMIŞ adım sayısı (0..6)
 *   Gösterilen adım              = 1..6
 */

/**
 * Rolün gerçekten yürüdüğü adımlar.
 * Veli için sınav/sınıf/tarih/süre/seviye tespiti anlamsızdır: rol seçimiyle
 * biter, kalan bilgiyi bağlı olduğu öğrencinin profili taşır.
 */
export function stepsForRole(role: OnboardingRole): number[] {
  if (role === 'parent') return [1]
  return Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1)
}

/** Rol için sihirbazın son adımı. */
export function lastStepForRole(role: OnboardingRole): number {
  const steps = stepsForRole(role)
  return steps[steps.length - 1] ?? 1
}

/**
 * Verilen adım tamamlandığında sıradaki adım.
 * Sihirbaz bittiyse `null` döner — çağıran tarafın onboarding'i kapatması gerekir.
 */
export function nextStep(role: OnboardingRole, current: number): number | null {
  const steps = stepsForRole(role)
  const index = steps.indexOf(current)
  if (index === -1) return steps[0] ?? null
  return steps[index + 1] ?? null
}

/** Geri düğmesinin hedefi; ilk adımdaysa `null` (geri gidilecek yer yok). */
export function previousStep(role: OnboardingRole, current: number): number | null {
  const steps = stepsForRole(role)
  const index = steps.indexOf(current)
  if (index <= 0) return null
  return steps[index - 1] ?? null
}

/**
 * Sayfa yenilendiğinde nereden devam edileceği.
 * Kaynak veritabanıdır (`profiles.onboarding_step`), React state'i değil —
 * kabul kriteri tam sayfa yenilemesinden sağ çıkmaktır.
 */
export function resolveResumeStep(role: OnboardingRole, savedStep: number): number {
  const steps = stepsForRole(role)
  const first = steps[0] ?? 1
  if (!Number.isFinite(savedStep) || savedStep <= 0) return first

  const last = lastStepForRole(role)
  const candidate = Math.floor(savedStep) + 1
  if (candidate <= first) return first
  return Math.min(candidate, last)
}

/** İlerleme çubuğu için 0–100 arası yüzde (mevcut adım "devam ediyor" sayılır). */
export function progressPercent(role: OnboardingRole, current: number): number {
  const steps = stepsForRole(role)
  const index = steps.indexOf(current)
  const position = index === -1 ? 0 : index
  return Math.round((position / steps.length) * 100)
}

/**
 * Sihirbaz bittiğinde kullanıcının gideceği sayfa.
 * `startPlacement` ise öğrenci doğrudan seviye tespit sınavına götürülür
 * (spec §M7); sınav orada başlatılır, panelde bir bayrakla değil.
 */
export function homeForRole(role: OnboardingRole, startPlacement = false): string {
  if (role === 'student' && startPlacement) return '/seviye-tespit'
  return ROLE_HOME[role]
}
