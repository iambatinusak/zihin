import base from '@/i18n/tr.json'
import onboardingSection from '@/i18n/tr/onboarding.json'
import { createDictionary, type Section } from './core'

/**
 * Onboarding sihirbazının sözlüğü.
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, onboardingSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
