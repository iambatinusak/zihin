import base from '@/i18n/tr.json'
import adminMediaSection from '@/i18n/tr/admin-media.json'
import { createDictionary, type Section } from './core'

/**
 * Admin içerik sözlüğü (video, test, deneme, kart).
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, adminMediaSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
