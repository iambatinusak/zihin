import base from '@/i18n/tr.json'
import cardsSection from '@/i18n/tr/cards.json'
import { createDictionary, type Section } from './core'

/**
 * Hafıza kartı sözlüğü.
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, cardsSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
