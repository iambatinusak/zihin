import base from '@/i18n/tr.json'
import testSection from '@/i18n/tr/test.json'
import testUiSection from '@/i18n/tr/test-ui.json'
import cardsSection from '@/i18n/tr/cards.json'
import { createDictionary, type Section } from './core'

/**
 * Test çözme ve sonuç sözlüğü. `test.*` üç dosyadan beslenir.
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([base, testSection, testUiSection, cardsSection] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
