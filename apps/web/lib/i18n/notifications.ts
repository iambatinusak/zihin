import base from '@/i18n/tr.json'
import notificationsSection from '@/i18n/tr/notifications.json'
import { createDictionary, type Section } from './core'

/**
 * Bildirim sözlüğü (zil, liste, tercihler).
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, notificationsSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
