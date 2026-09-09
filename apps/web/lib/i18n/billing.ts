import base from '@/i18n/tr.json'
import billingSection from '@/i18n/tr/billing.json'
import { createDictionary, type Section } from './core'

/**
 * Ödeme ve paket sözlüğü.
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, billingSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
