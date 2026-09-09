import { describe, expect, it } from 'vitest'
import {
  TR_OFFSET_MS,
  turkeyDayKey,
  turkeyDayWindow,
  turkeyWeekStartKey,
  turkeyWeekWindow,
} from './turkey'

describe('TR_OFFSET_MS', () => {
  it('UTC+3, yaz saati yok', () => {
    expect(TR_OFFSET_MS).toBe(3 * 60 * 60 * 1000)
  })
})

describe('turkeyDayKey', () => {
  it('gün Türkiye gece yarısında döner (21:00 UTC)', () => {
    expect(turkeyDayKey('2026-09-09T20:59:59Z')).toBe('2026-09-09')
    expect(turkeyDayKey('2026-09-09T21:00:00Z')).toBe('2026-09-10')
  })

  it('kışın ve yazın aynı sınırı kullanır', () => {
    expect(turkeyDayKey('2026-01-01T21:00:00Z')).toBe('2026-01-02')
    expect(turkeyDayKey('2026-07-01T21:00:00Z')).toBe('2026-07-02')
  })

  it('geçersiz tarihte boş metin', () => {
    expect(turkeyDayKey('bir tarih değil')).toBe('')
    expect(turkeyDayKey(Number.NaN)).toBe('')
  })
})

describe('turkeyDayWindow', () => {
  it('pencere Türkiye gününün UTC karşılığıdır', () => {
    const window = turkeyDayWindow(new Date('2026-03-10T12:00:00Z'))
    expect(window.dayKey).toBe('2026-03-10')
    expect(window.startIso).toBe('2026-03-09T21:00:00.000Z')
    expect(window.endIso).toBe('2026-03-10T21:00:00.000Z')
  })

  it('geçersiz tarihte hiçbir satırı kapsamayan aralık', () => {
    const window = turkeyDayWindow('geçersiz')
    expect(window.dayKey).toBe('')
    expect(window.startIso).toBe(window.endIso)
  })
})

describe('turkeyWeekStartKey — ISO pazartesi', () => {
  it('hafta içi her gün aynı pazartesiyi verir', () => {
    // 2026-09-07 pazartesi, 2026-09-13 pazar.
    expect(turkeyWeekStartKey('2026-09-07T00:00:00Z')).toBe('2026-09-07')
    expect(turkeyWeekStartKey('2026-09-09T12:00:00Z')).toBe('2026-09-07')
    expect(turkeyWeekStartKey('2026-09-13T20:00:00Z')).toBe('2026-09-07')
  })

  it('pazar 21:00 UTC artık yeni haftadır (TR pazartesi 00:00)', () => {
    expect(turkeyWeekStartKey('2026-09-13T20:59:59Z')).toBe('2026-09-07')
    expect(turkeyWeekStartKey('2026-09-13T21:00:00Z')).toBe('2026-09-14')
  })

  it('geçersiz tarihte boş metin', () => {
    expect(turkeyWeekStartKey('geçersiz')).toBe('')
  })
})

describe('turkeyWeekWindow — liderlik tablosunun sıfırlanma sınırı', () => {
  it('pazartesiden pazara, UTC sınırlarıyla', () => {
    const week = turkeyWeekWindow(new Date('2026-09-09T12:00:00Z'))
    expect(week.weekStart).toBe('2026-09-07')
    expect(week.weekEnd).toBe('2026-09-13')
    expect(week.startIso).toBe('2026-09-06T21:00:00.000Z')
    expect(week.endIso).toBe('2026-09-13T21:00:00.000Z')
  })

  it('pazartesi 00:00 TR yeni haftayı başlatır', () => {
    const before = turkeyWeekWindow(new Date('2026-09-13T20:59:59Z'))
    const after = turkeyWeekWindow(new Date('2026-09-13T21:00:00Z'))
    expect(before.weekStart).toBe('2026-09-07')
    expect(after.weekStart).toBe('2026-09-14')
  })

  it('geçersiz tarihte boş pencere', () => {
    const week = turkeyWeekWindow('geçersiz')
    expect(week.weekStart).toBe('')
    expect(week.startIso).toBe(week.endIso)
  })
})
