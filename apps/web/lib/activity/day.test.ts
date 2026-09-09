import { describe, expect, it } from 'vitest'
import { lastDayKeys, longDayLabel, turkeyDayKey, weekdayLabel } from './day'

describe('turkeyDayKey', () => {
  it('UTC gününü değil Türkiye gününü verir', () => {
    // 21:30 UTC = ertesi günün 00:30'u Türkiye'de.
    expect(turkeyDayKey('2026-09-09T21:30:00Z')).toBe('2026-09-10')
    expect(turkeyDayKey('2026-09-09T20:59:59Z')).toBe('2026-09-09')
  })

  it('gün sınırını UTC+3 kabul eder, yaz saati uygulamaz', () => {
    // Temmuz (yaz) ve Ocak (kış) aynı kaymayı görür.
    expect(turkeyDayKey('2026-07-01T21:00:00Z')).toBe('2026-07-02')
    expect(turkeyDayKey('2026-01-01T21:00:00Z')).toBe('2026-01-02')
  })

  it('Date, metin ve milisaniye kabul eder', () => {
    const date = new Date('2026-03-15T10:00:00Z')
    expect(turkeyDayKey(date)).toBe('2026-03-15')
    expect(turkeyDayKey(date.getTime())).toBe('2026-03-15')
    expect(turkeyDayKey('2026-03-15T10:00:00Z')).toBe('2026-03-15')
  })

  it('geçersiz tarihte boş metin döner', () => {
    expect(turkeyDayKey('bir tarih değil')).toBe('')
    expect(turkeyDayKey(Number.NaN)).toBe('')
    expect(turkeyDayKey(new Date('geçersiz'))).toBe('')
  })
})

describe('lastDayKeys', () => {
  it('bugün dâhil, eskiden yeniye sıralı verir', () => {
    expect(lastDayKeys('2026-09-09T12:00:00Z', 7)).toEqual([
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ])
  })

  it('ay ve yıl sınırını doğru geçer', () => {
    expect(lastDayKeys('2027-01-01T05:00:00Z', 3)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ])
  })

  it('sayı geçersizse boş liste döner', () => {
    expect(lastDayKeys('2026-09-09T12:00:00Z', 0)).toEqual([])
    expect(lastDayKeys('2026-09-09T12:00:00Z', -3)).toEqual([])
    expect(lastDayKeys('geçersiz', 7)).toEqual([])
  })
})

describe('etiketler', () => {
  it('Türkçe kısa gün adı verir', () => {
    // 2026-09-09 bir çarşamba.
    expect(weekdayLabel('2026-09-09')).toBe('Çar')
    expect(weekdayLabel('2026-09-13')).toBe('Paz')
    expect(weekdayLabel('bozuk')).toBe('')
  })

  it('gün ve ay adını Türkçe verir', () => {
    expect(longDayLabel('2026-09-09')).toBe('9 Eylül')
    expect(longDayLabel('2026-12-31')).toBe('31 Aralık')
    expect(longDayLabel('bozuk')).toBe('bozuk')
  })
})
