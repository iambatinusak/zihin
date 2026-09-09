import base from '@/i18n/tr.json'
import helpSection from '@/i18n/tr/help.json'
import { createDictionary, type Section } from './core'

/**
 * Soru sor sözlüğü (öğrenci formu + öğretmen kuyruğu).
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, helpSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
