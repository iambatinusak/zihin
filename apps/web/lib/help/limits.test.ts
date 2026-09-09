import { describe, expect, it } from 'vitest'
import {
  bestDailyQuestionLimit,
  DEFAULT_DAILY_QUESTION_LIMIT,
  quotaState,
  readDailyQuestionLimit,
  turkeyDayWindow,
} from './limits'

describe('readDailyQuestionLimit', () => {
  it('paketin features alanındaki sayıyı okur', () => {
    expect(readDailyQuestionLimit({ daily_question_limit: 10, coaching: false })).toBe(10)
  })

  it('0 geçerli bir limittir (soru sorma kapalı paket)', () => {
    expect(readDailyQuestionLimit({ daily_question_limit: 0 })).toBe(0)
  })

  it('alan yoksa, null ise ya da tür tutmuyorsa varsayılana düşer', () => {
    expect(readDailyQuestionLimit({})).toBe(DEFAULT_DAILY_QUESTION_LIMIT)
    expect(readDailyQuestionLimit(null)).toBe(DEFAULT_DAILY_QUESTION_LIMIT)
    expect(readDailyQuestionLimit([])).toBe(DEFAULT_DAILY_QUESTION_LIMIT)
    expect(readDailyQuestionLimit('3')).toBe(DEFAULT_DAILY_QUESTION_LIMIT)
    expect(readDailyQuestionLimit({ daily_question_limit: 'çok' })).toBe(
      DEFAULT_DAILY_QUESTION_LIMIT,
    )
    expect(readDailyQuestionLimit({ daily_question_limit: Number.NaN })).toBe(
      DEFAULT_DAILY_QUESTION_LIMIT,
    )
  })

  it('negatif değer sınırsıza dönüşmez, varsayılana düşer', () => {
    expect(readDailyQuestionLimit({ daily_question_limit: -1 })).toBe(DEFAULT_DAILY_QUESTION_LIMIT)
  })

  it('ondalık değeri aşağı yuvarlar', () => {
    expect(readDailyQuestionLimit({ daily_question_limit: 4.9 })).toBe(4)
  })
})

describe('bestDailyQuestionLimit', () => {
  it('abonelik yoksa varsayılan', () => {
    expect(bestDailyQuestionLimit([])).toBe(DEFAULT_DAILY_QUESTION_LIMIT)
  })

  it('birden fazla paket varsa en cömerti geçerli', () => {
    expect(
      bestDailyQuestionLimit([{ daily_question_limit: 3 }, { daily_question_limit: 20 }]),
    ).toBe(20)
  })

  it('tek paket 0 diyorsa 0 kalır — varsayılana yükseltilmez', () => {
    expect(bestDailyQuestionLimit([{ daily_question_limit: 0 }])).toBe(0)
  })
})

describe('turkeyDayWindow — Türkiye gece yarısı sınırı', () => {
  it('TR gününün başlangıcı UTC 21:00 (bir önceki gün)', () => {
    const window = turkeyDayWindow(new Date('2026-03-10T12:00:00Z'))
    expect(window.dayKey).toBe('2026-03-10')
    expect(window.startIso).toBe('2026-03-09T21:00:00.000Z')
    expect(window.endIso).toBe('2026-03-10T21:00:00.000Z')
  })

  it('UTC 21:00 (TR 00:00) yeni güne aittir', () => {
    const before = turkeyDayWindow(new Date('2026-03-09T20:59:59Z'))
    const after = turkeyDayWindow(new Date('2026-03-09T21:00:00Z'))
    expect(before.dayKey).toBe('2026-03-09')
    expect(after.dayKey).toBe('2026-03-10')
    // Sınırın kendisi yeni güne ait: aralık [start, end)
    expect(after.startIso).toBe('2026-03-09T21:00:00.000Z')
  })

  it('UTC gün dönümü TR gününü değiştirmez', () => {
    const beforeMidnightUtc = turkeyDayWindow(new Date('2026-03-09T23:30:00Z'))
    const afterMidnightUtc = turkeyDayWindow(new Date('2026-03-10T00:30:00Z'))
    expect(beforeMidnightUtc.dayKey).toBe('2026-03-10')
    expect(afterMidnightUtc.dayKey).toBe('2026-03-10')
    expect(beforeMidnightUtc.startIso).toBe(afterMidnightUtc.startIso)
  })

  it('aralık tam 24 saattir', () => {
    const window = turkeyDayWindow(new Date('2026-07-01T09:00:00Z'))
    const span = Date.parse(window.endIso) - Date.parse(window.startIso)
    expect(span).toBe(24 * 60 * 60 * 1000)
  })

  it('geçersiz tarihte hiçbir satırı kapsamayan aralık döner', () => {
    const window = turkeyDayWindow('bir tarih değil')
    expect(window.dayKey).toBe('')
    expect(window.startIso).toBe(window.endIso)
  })
})

describe('quotaState', () => {
  it('kalan hakkı hesaplar', () => {
    expect(quotaState(3, 1)).toEqual({ limit: 3, used: 1, remaining: 2, exhausted: false })
  })

  it('limit dolduğunda tükenmiş sayılır', () => {
    expect(quotaState(3, 3).exhausted).toBe(true)
  })

  it('kullanılan limiti aşsa bile kalan negatif olmaz', () => {
    expect(quotaState(3, 9)).toEqual({ limit: 3, used: 9, remaining: 0, exhausted: true })
  })

  it('limit 0 ise baştan tükenmiştir', () => {
    expect(quotaState(0, 0)).toEqual({ limit: 0, used: 0, remaining: 0, exhausted: true })
  })
})
