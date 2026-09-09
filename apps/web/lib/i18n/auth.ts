import base from '@/i18n/tr.json'
import authSection from '@/i18n/tr/auth.json'
import { createDictionary, type Section } from './core'

/**
 * Kimlik ekranlarının sözlüğü: paylaşılanlar + auth.
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, authSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
