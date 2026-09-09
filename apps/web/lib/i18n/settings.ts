import base from '@/i18n/tr.json'
import settingsSection from '@/i18n/tr/settings.json'
import { createDictionary, type Section } from './core'

/**
 * Ayarlar ve veli bağlama sözlüğü (settings + link).
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, settingsSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
