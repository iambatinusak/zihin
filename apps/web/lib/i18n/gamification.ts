import base from '@/i18n/tr.json'
import gamificationSection from '@/i18n/tr/gamification.json'
import { createDictionary, type Section } from './core'

/**
 * Rozet, seviye ve liderlik sözlüğü.
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, gamificationSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
