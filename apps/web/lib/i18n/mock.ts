import base from '@/i18n/tr.json'
import testSection from '@/i18n/tr/test.json'
import testUiSection from '@/i18n/tr/test-ui.json'
import cardsSection from '@/i18n/tr/cards.json'
import mockSection from '@/i18n/tr/mock.json'
import { createDictionary, type Section } from './core'

/**
 * Deneme sınavı sözlüğü; ekran test bileşenlerini yeniden kullandığı için test bölümleri de gerekir.
 *
 * Bölüm sırası `lib/i18n.ts` içindeki kanonik sırayla aynıdır.
 */
const dictionary = createDictionary([
  base,
  testSection,
  testUiSection,
  cardsSection,
  mockSection,
] as Section[])

export const t = dictionary.t
export const section = dictionary.section
export { fill } from './core'
