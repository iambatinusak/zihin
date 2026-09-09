import { describe, expect, it } from 'vitest'
import { timelineSince, toWeeklyAverages, weekStartKey } from './timeline'

describe('weekStartKey', () => {
  it('haftanın pazartesisine yuvarlar', () => {
    // 2026-09-09 çarşamba → 2026-09-07 pazartesi
    expect(weekStartKey('2026-09-09T12:00:00.000Z')).toBe('2026-09-07')
    expect(weekStartKey('2026-09-07T00:00:00.000Z')).toBe('2026-09-07')
    expect(weekStartKey('2026-09-13T20:00:00.000Z')).toBe('2026-09-07')
  })

  it('pazar gününü aynı haftada tutar (ISO: hafta pazartesi başlar)', () => {
    expect(weekStartKey('2026-09-13T12:00:00.000Z')).toBe('2026-09-07')
    expect(weekStartKey('2026-09-14T00:00:00.000Z')).toBe('2026-09-14')
  })

  it('Türkiye saatine göre böler: pazar 22:00 UTC zaten pazartesidir', () => {
    expect(weekStartKey('2026-09-13T21:30:00.000Z')).toBe('2026-09-14')
  })

  it('geçersiz tarihte boş anahtar döner', () => {
    expect(weekStartKey('gecersiz')).toBe('')
  })
})

describe('toWeeklyAverages', () => {
  it('haftalara böler, ortalar ve eskiden yeniye sıralar', () => {
    const result = toWeeklyAverages([
      { mastery: 80, recordedAt: '2026-09-09T09:00:00.000Z' },
      { mastery: 40, recordedAt: '2026-09-10T09:00:00.000Z' },
      { mastery: 30, recordedAt: '2026-09-02T09:00:00.000Z' },
    ])

    expect(result).toEqual([
      { weekStart: '2026-08-31', averageMastery: 30, sampleCount: 1 },
      { weekStart: '2026-09-07', averageMastery: 60, sampleCount: 2 },
    ])
  })

  it('ortalamayı tam sayıya yuvarlar', () => {
    const result = toWeeklyAverages([
      { mastery: 50, recordedAt: '2026-09-08T09:00:00.000Z' },
      { mastery: 51, recordedAt: '2026-09-08T10:00:00.000Z' },
    ])
    expect(result[0]?.averageMastery).toBe(51)
  })

  it('geçersiz tarihli kayıtları hesaba katmaz', () => {
    expect(toWeeklyAverages([{ mastery: 90, recordedAt: 'gecersiz' }])).toEqual([])
  })

  it('veri yoksa boş dizi döner — uydurma sıfır üretilmez', () => {
    expect(toWeeklyAverages([])).toEqual([])
  })
})

describe('timelineSince', () => {
  const now = new Date('2026-09-09T00:00:00.000Z')

  it('istenen hafta kadar geriye gider', () => {
    expect(timelineSince(now, 2).toISOString()).toBe('2026-08-26T00:00:00.000Z')
  })

  it('geçersiz ya da sıfır hafta bir haftaya düşer', () => {
    expect(timelineSince(now, 0).toISOString()).toBe('2026-09-02T00:00:00.000Z')
    expect(timelineSince(now, Number.NaN).toISOString()).toBe('2026-09-02T00:00:00.000Z')
  })
})
