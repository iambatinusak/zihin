import { describe, expect, it } from 'vitest'
import {
  canGoNextWeek,
  isCurrentWeek,
  nextWeekStart,
  previousWeekStart,
  resolveWeekStart,
  weekDelta,
  weekInstantRange,
  weekRange,
  weekRangeLabel,
} from './week'

/** 9 Eylül 2025 Salı, TSİ 12:00 → haftanın başı 8 Eylül Pazartesi. */
const TUESDAY = new Date('2025-09-09T09:00:00Z')

describe('weekRange', () => {
  it('Pazartesi-Pazar aralığı verir', () => {
    expect(weekRange('2025-09-08')).toEqual({ start: '2025-09-08', end: '2025-09-14' })
  })

  it('hafta içi bir günü kendi Pazartesisine çeker', () => {
    expect(weekRange('2025-09-11')).toEqual({ start: '2025-09-08', end: '2025-09-14' })
  })

  it('Pazar günü hâlâ o haftaya aittir (ISO hafta)', () => {
    expect(weekRange('2025-09-14')).toEqual({ start: '2025-09-08', end: '2025-09-14' })
  })

  it('ay ve yıl sınırını doğru geçer', () => {
    expect(weekRange('2025-01-01')).toEqual({ start: '2024-12-30', end: '2025-01-05' })
  })
})

describe('weekInstantRange', () => {
  it('Türkiye gününün başına sabitlenmiş yarı açık aralık verir', () => {
    expect(weekInstantRange('2025-09-08')).toEqual({
      from: '2025-09-08T00:00:00+03:00',
      to: '2025-09-15T00:00:00+03:00',
    })
  })

  it('bitiş sınırı bir sonraki haftanın başlangıcıyla çakışmaz (yarı açık)', () => {
    expect(weekInstantRange('2025-09-08').to).toBe(weekInstantRange('2025-09-15').from)
  })
})

describe('resolveWeekStart', () => {
  it('parametre yoksa içinde bulunulan haftayı verir', () => {
    expect(resolveWeekStart(null, TUESDAY)).toBe('2025-09-08')
    expect(resolveWeekStart(undefined, TUESDAY)).toBe('2025-09-08')
  })

  it('geçmiş bir haftayı kabul eder', () => {
    expect(resolveWeekStart('2025-08-25', TUESDAY)).toBe('2025-08-25')
  })

  it('gelecek haftayı bu haftaya kırpar', () => {
    expect(resolveWeekStart('2025-12-01', TUESDAY)).toBe('2025-09-08')
  })

  it('geçersiz biçimi yok sayar, fırlatmaz', () => {
    expect(resolveWeekStart('bugun', TUESDAY)).toBe('2025-09-08')
    expect(resolveWeekStart('2025-02-31', TUESDAY)).toBe('2025-09-08')
    expect(resolveWeekStart('', TUESDAY)).toBe('2025-09-08')
  })

  it('hafta ortasındaki bir tarihi Pazartesiye çeker', () => {
    expect(resolveWeekStart('2025-09-03', TUESDAY)).toBe('2025-09-01')
  })

  it('ölçüt Türkiye günüdür: UTC Pazar 22:00 zaten Pazartesidir', () => {
    // 2025-09-07T22:00Z = 2025-09-08T01:00 TSİ → hafta 8 Eylül.
    expect(resolveWeekStart(null, new Date('2025-09-07T22:00:00Z'))).toBe('2025-09-08')
    // 2025-09-07T20:00Z = 2025-09-07T23:00 TSİ → hâlâ önceki hafta.
    expect(resolveWeekStart(null, new Date('2025-09-07T20:00:00Z'))).toBe('2025-09-01')
  })
})

describe('hafta gezinmesi', () => {
  it('önceki ve sonraki hafta yedi gün kaydırır', () => {
    expect(previousWeekStart('2025-09-08')).toBe('2025-09-01')
    expect(nextWeekStart('2025-09-08')).toBe('2025-09-15')
  })

  it('bu haftadan ileri gidilemez', () => {
    expect(canGoNextWeek('2025-09-08', TUESDAY)).toBe(false)
    expect(canGoNextWeek('2025-09-01', TUESDAY)).toBe(true)
  })

  it('içinde bulunulan haftayı tanır', () => {
    expect(isCurrentWeek('2025-09-08', TUESDAY)).toBe(true)
    expect(isCurrentWeek('2025-09-01', TUESDAY)).toBe(false)
  })
})

describe('weekRangeLabel', () => {
  it('Türkçe ay adıyla aralık yazar', () => {
    expect(weekRangeLabel('2025-09-08')).toBe('8 Eylül – 14 Eylül')
  })

  it('ay sınırını aşan haftada iki ay adı görünür', () => {
    expect(weekRangeLabel('2025-09-29')).toBe('29 Eylül – 5 Ekim')
  })
})

describe('weekDelta', () => {
  it('artışı yüzdeyle verir', () => {
    expect(weekDelta(120, 100)).toEqual({
      direction: 'up',
      percent: 20,
      difference: 20,
      text: '%20',
    })
  })

  it('azalışta yüzde mutlak değerdir, yön aşağıdır', () => {
    expect(weekDelta(50, 100)).toEqual({
      direction: 'down',
      percent: 50,
      difference: -50,
      text: '%50',
    })
  })

  it('değişim yoksa düz döner', () => {
    expect(weekDelta(100, 100)).toEqual({
      direction: 'flat',
      percent: 0,
      difference: 0,
      text: '%0',
    })
  })

  it('sıfırdan büyümede yüzde uydurmaz', () => {
    expect(weekDelta(30, 0)).toEqual({
      direction: 'new',
      percent: null,
      difference: 30,
      text: null,
    })
  })

  it('iki hafta da boşsa ok gösterilmez', () => {
    expect(weekDelta(0, 0)).toEqual({
      direction: 'none',
      percent: null,
      difference: 0,
      text: null,
    })
  })

  it('çok küçük değişim yüzde sıfıra yuvarlanır ve düz sayılır', () => {
    expect(weekDelta(1000, 999).direction).toBe('flat')
  })

  it('geçersiz sayıları sıfır kabul eder, NaN sızdırmaz', () => {
    expect(weekDelta(Number.NaN, 100).direction).toBe('down')
    expect(weekDelta(100, Number.NaN).direction).toBe('new')
  })
})
