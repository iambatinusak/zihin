import { describe, expect, it } from 'vitest'
import { formatCountdown, secondsUntil } from './countdown'

const UNITS = { day: 'g', hour: 'sa', minute: 'dk', second: 'sn' }

describe('secondsUntil', () => {
  const now = Date.parse('2026-03-01T12:00:00.000Z')

  it('gelecekteki hedefe kalan saniyeyi verir', () => {
    expect(secondsUntil('2026-03-01T12:01:00.000Z', now)).toBe(60)
  })

  it('geçmiş hedefte 0 döner, negatife düşmez', () => {
    expect(secondsUntil('2026-03-01T11:00:00.000Z', now)).toBe(0)
  })

  it('okunamayan ya da boş hedefte null döner', () => {
    expect(secondsUntil(null, now)).toBeNull()
    expect(secondsUntil('  ', now)).toBeNull()
    expect(secondsUntil('yarın', now)).toBeNull()
  })
})

describe('formatCountdown', () => {
  it('en fazla iki birim gösterir', () => {
    expect(formatCountdown(2 * 86400 + 5 * 3600 + 13 * 60 + 7, UNITS)).toBe('2 g 5 sa')
    expect(formatCountdown(5 * 3600 + 13 * 60 + 7, UNITS)).toBe('5 sa 13 dk')
    expect(formatCountdown(13 * 60 + 7, UNITS)).toBe('13 dk 7 sn')
  })

  it('bir dakikanın altında saniye tek başına gösterilir', () => {
    expect(formatCountdown(7, UNITS)).toBe('7 sn')
  })

  it('negatif ve geçersiz değerler sıfır sayılır', () => {
    expect(formatCountdown(-5, UNITS)).toBe('0 sn')
    expect(formatCountdown(Number.NaN, UNITS)).toBe('0 sn')
  })
})
