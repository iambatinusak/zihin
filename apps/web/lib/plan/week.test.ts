import { describe, expect, it } from 'vitest'

import {
  addDaysIso,
  addWeeksIso,
  dayNumberOfIso,
  dayParts,
  diffDays,
  isInWeek,
  isIsoDate,
  isoWeekday,
  todayIso,
  toDayNumber,
  toTurkeyDate,
  weekDates,
  weekStartOf,
  weekStartOfIso,
} from './week'

describe('gün numarası', () => {
  it('UTC gece yarısından önceki Türkiye saatini ERTESİ güne sayar', () => {
    // 2025-05-11T21:30Z = 12 Mayıs 00:30 TR. Sunucu UTC'de olsa da gün 12'dir.
    expect(todayIso(new Date('2025-05-11T21:30:00Z'))).toBe('2025-05-12')
  })

  it('UTC günün ortasında da aynı günü verir', () => {
    expect(todayIso(new Date('2025-05-12T09:00:00Z'))).toBe('2025-05-12')
  })

  it('gidiş-dönüş kayıpsızdır', () => {
    expect(toDayNumber(toTurkeyDate('2025-05-12'))).toBe(dayNumberOfIso('2025-05-12'))
  })
})

describe('isoWeekday', () => {
  it('Pazartesi 1, Pazar 7 döner', () => {
    expect(isoWeekday(dayNumberOfIso('2025-05-12'))).toBe(1) // Pazartesi
    expect(isoWeekday(dayNumberOfIso('2025-05-18'))).toBe(7) // Pazar
  })

  it('1970 öncesi negatif gün numaralarında da doğrudur', () => {
    expect(isoWeekday(dayNumberOfIso('1969-12-29'))).toBe(1)
  })
})

describe('hafta başlangıcı', () => {
  it("haftanın her günü aynı Pazartesi'yi verir", () => {
    for (const day of weekDates('2025-05-12')) {
      expect(weekStartOfIso(day)).toBe('2025-05-12')
    }
  })

  it('Pazar gecesi hâlâ o haftaya aittir', () => {
    expect(weekStartOf(new Date('2025-05-18T20:59:00Z'))).toBe('2025-05-12')
  })

  it('Pazartesi 00:30 TR yeni haftadır', () => {
    expect(weekStartOf(new Date('2025-05-18T21:30:00Z'))).toBe('2025-05-19')
  })
})

describe('weekDates', () => {
  it('yedi ardışık gün üretir', () => {
    expect(weekDates('2025-05-12')).toEqual([
      '2025-05-12',
      '2025-05-13',
      '2025-05-14',
      '2025-05-15',
      '2025-05-16',
      '2025-05-17',
      '2025-05-18',
    ])
  })

  it('bozuk tarihte boş dizi döner', () => {
    expect(weekDates('bozuk')).toEqual([])
  })
})

describe('tarih aritmetiği', () => {
  it('ay ve yıl sınırını aşar', () => {
    expect(addDaysIso('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDaysIso('2024-02-28', 1)).toBe('2024-02-29') // artık yıl
    expect(addWeeksIso('2025-05-12', -1)).toBe('2025-05-05')
  })

  it('diffDays işaretli fark verir', () => {
    expect(diffDays('2025-05-14', '2025-05-12')).toBe(2)
    expect(diffDays('2025-05-12', '2025-05-14')).toBe(-2)
  })
})

describe('isInWeek', () => {
  it('haftanın içini kabul, dışını reddeder', () => {
    expect(isInWeek('2025-05-12', '2025-05-12')).toBe(true)
    expect(isInWeek('2025-05-18', '2025-05-12')).toBe(true)
    expect(isInWeek('2025-05-19', '2025-05-12')).toBe(false)
    expect(isInWeek('2025-05-11', '2025-05-12')).toBe(false)
  })
})

describe('isIsoDate', () => {
  it('biçime uyan ama takvimde olmayan tarihi reddeder', () => {
    expect(isIsoDate('2025-05-12')).toBe(true)
    expect(isIsoDate('2025-02-31')).toBe(false)
    expect(isIsoDate('12.05.2025')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })
})

describe('dayParts', () => {
  it('yerel saat dilimine bakmadan parçalar', () => {
    expect(dayParts('2025-01-01')).toEqual({ weekday: 3, day: 1, month: 1, year: 2025 })
  })
})
