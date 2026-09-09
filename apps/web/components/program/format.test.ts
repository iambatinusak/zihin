import { describe, expect, it } from 'vitest'

import strings from '@/i18n/tr/program.json'
import {
  dayLabel,
  fullDayLabel,
  minutesLabel,
  weekRangeLabel,
  weekdayLabel,
  weekdayShortLabel,
} from './format'

// Etiketler gerçek sözlükle sınanır: bir gün/ay adı eksik kalırsa test düşer.
const names = strings.program

describe('gün etiketleri', () => {
  it('gün ve ay adını sözlükten alır', () => {
    expect(weekdayLabel('2025-05-12', names)).toBe('Pazartesi')
    expect(weekdayShortLabel('2025-05-18', names)).toBe('Paz')
    expect(dayLabel('2025-05-12', names)).toBe('12 Mayıs')
    expect(fullDayLabel('2025-01-01', names)).toBe('1 Ocak 2025')
  })

  it('yılın her ayı için bir ad vardır', () => {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `2025-${String(month).padStart(2, '0')}-15`
      expect(dayLabel(iso, names)).not.toMatch(/\s$/)
    }
  })
})

describe('weekRangeLabel', () => {
  it('aynı ay içinde ayı bir kez yazar', () => {
    expect(weekRangeLabel('2025-05-12', names)).toBe('12 – 18 Mayıs 2025')
  })

  it('ay değişiyorsa iki ayı da yazar', () => {
    expect(weekRangeLabel('2025-04-28', names)).toBe('28 Nisan – 4 Mayıs 2025')
  })

  it('yıl değişiyorsa iki yılı da yazar', () => {
    expect(weekRangeLabel('2025-12-29', names)).toBe('29 Aralık 2025 – 4 Ocak 2026')
  })

  it('bozuk tarihte boş metin döner', () => {
    expect(weekRangeLabel('bozuk', names)).toBe('')
  })
})

describe('minutesLabel', () => {
  it('yuvarlar ve negatifi sıfıra çeker', () => {
    expect(minutesLabel(44.6, 'dk')).toBe('45 dk')
    expect(minutesLabel(-5, 'dk')).toBe('0 dk')
  })
})
