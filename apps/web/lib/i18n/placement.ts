import base from '@/i18n/tr.json'
import placementSection from '@/i18n/tr/placement.json'
import { createDictionary, type Section } from './core'

/**
 * Seviye tespit ve öğrenci panosu sözlüğü (placement + dashboard).
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, placementSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
