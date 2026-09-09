import base from '@/i18n/tr.json'

/*
 * MVP'de tek dil (tr) var, ama tüm metinler tek kaynaktan okunur; ileride
 * ikinci bir dil eklemek için yalnızca sözlük kurulumu genişletilir.
 *
 * Sözlük iki parçadan oluşur:
 *   i18n/tr.json          — paylaşılan metinler (common, nav, shell, states...)
 *   i18n/tr/<özellik>.json — her özelliğin kendi metinleri
 *
 * Bölünmenin sebebi pratik: özellikler paralel geliştiriliyor ve tek bir dev
 * JSON dosyası sürekli çakışıyordu. Her özellik kendi dosyasını sahiplenir,
 * anahtar alanı yine tektir (`t('auth.login')`).
 */

// Bölüm dosyaları — yeni bir özellik eklerken buraya bir satır ekleyin.
// (Statik import zorunlu: Next.js derleme sırasında dinamik JSON okuyamaz.)
import authSection from '@/i18n/tr/auth.json'
import onboardingSection from '@/i18n/tr/onboarding.json'
import catalogSection from '@/i18n/tr/catalog.json'
import videoSection from '@/i18n/tr/video.json'
import settingsSection from '@/i18n/tr/settings.json'
import parentSection from '@/i18n/tr/parent.json'
import parentPanelSection from '@/i18n/tr/parent-panel.json'
import legalSection from '@/i18n/tr/legal.json'
import testSection from '@/i18n/tr/test.json'
// Test arayüzü (çözme + sonuç ekranları) kendi bölümünü ayrı tutar; anahtar kökü yine `test.*`.
import testUiSection from '@/i18n/tr/test-ui.json'
import masterySection from '@/i18n/tr/mastery.json'
import placementSection from '@/i18n/tr/placement.json'
import programSection from '@/i18n/tr/program.json'
import cardsSection from '@/i18n/tr/cards.json'
import panelSection from '@/i18n/tr/panel.json'
import helpSection from '@/i18n/tr/help.json'
import mockSection from '@/i18n/tr/mock.json'
import billingSection from '@/i18n/tr/billing.json'
import gamificationSection from '@/i18n/tr/gamification.json'
import notificationsSection from '@/i18n/tr/notifications.json'
import adminCoreSection from '@/i18n/tr/admin-core.json'
import adminQuestionsSection from '@/i18n/tr/admin-questions.json'
import adminMediaSection from '@/i18n/tr/admin-media.json'

import { createDictionary, DEFAULT_LOCALE, type Locale, type Section } from '@/lib/i18n/core'

export { DEFAULT_LOCALE, LOCALES, fill } from '@/lib/i18n/core'
export type { Locale } from '@/lib/i18n/core'

/*
 * TAM sözlük — yirmi dört bölümün hepsi. Server Component'ler buradan okur.
 *
 * Bir CLIENT COMPONENT bu modülü import ETMEMELİDİR: 94 kB'lık sözlüğün
 * tamamı tarayıcı paketine girer ve öğrenci admin metinlerini de indirir.
 * İstemcide `@/lib/i18n/<bölüm>` (örn. `@/lib/i18n/auth`) kullanın; yalnızca
 * `fill` gerekiyorsa `@/lib/i18n/core`.
 *
 * Aşağıdaki sıra KANONİKTİR; dar modüller aynı sırayı korur.
 */
const dictionary = createDictionary([
  base,
  authSection,
  onboardingSection,
  catalogSection,
  videoSection,
  settingsSection,
  parentSection,
  parentPanelSection,
  legalSection,
  testSection,
  testUiSection,
  masterySection,
  programSection,
  panelSection,
  cardsSection,
  placementSection,
  mockSection,
  helpSection,
  notificationsSection,
  gamificationSection,
  billingSection,
  adminMediaSection,
  adminQuestionsSection,
  adminCoreSection,
] as Section[])

export const t = dictionary.t
export const section = dictionary.section

export function getDictionary(locale: Locale = DEFAULT_LOCALE) {
  return dictionary.getDictionary(locale)
}
