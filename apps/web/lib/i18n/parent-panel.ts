import base from '@/i18n/tr.json'
import parentPanelSection from '@/i18n/tr/parent-panel.json'
import { createDictionary, type Section } from './core'

/**
 * Veli paneli sözlüğü.
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, parentPanelSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
