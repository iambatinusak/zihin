import base from '@/i18n/tr.json'
import adminCoreSection from '@/i18n/tr/admin-core.json'
import { createDictionary, type Section } from './core'

/**
 * Admin çekirdek sözlüğü (müfredat, kullanıcılar).
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, adminCoreSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
