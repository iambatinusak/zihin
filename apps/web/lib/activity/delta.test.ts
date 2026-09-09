import { describe, expect, it } from 'vitest'
import {
  applyDelta,
  EMPTY_TOTALS,
  isEmptyDelta,
  MAX_SECONDS_PER_CALL,
  meetsStreakThreshold,
  sanitizeDelta,
  STREAK_MIN_SECONDS,
} from './delta'

describe('sanitizeDelta', () => {
  it('verilmeyen alanları sıfırlar', () => {
    expect(sanitizeDelta({})).toEqual({
      seconds: 0,
      questions: 0,
      cards: 0,
      blocks: 0,
      videos: 0,
      xp: 0,
    })
  })

  it('negatif ve geçersiz sayaçları sıfıra çeker', () => {
    const safe = sanitizeDelta({
      seconds: -100,
      questions: Number.NaN,
      cards: Number.POSITIVE_INFINITY,
      blocks: -0.5,
    })
    expect(safe.seconds).toBe(0)
    expect(safe.questions).toBe(0)
    expect(safe.cards).toBe(0)
    expect(safe.blocks).toBe(0)
  })

  it('kesirli değerleri aşağı yuvarlar', () => {
    expect(sanitizeDelta({ seconds: 90.9, questions: 3.7 })).toMatchObject({
      seconds: 90,
      questions: 3,
    })
  })

  it('tek çağrıda 16 saatten fazla süreyi kırpar', () => {
    expect(sanitizeDelta({ seconds: 99_999_999 }).seconds).toBe(MAX_SECONDS_PER_CALL)
  })

  it('XP düzeltmesi negatif kalabilir', () => {
    expect(sanitizeDelta({ xp: -40 }).xp).toBe(-40)
    expect(sanitizeDelta({ xp: Number.NaN }).xp).toBe(0)
  })
})

describe('isEmptyDelta', () => {
  it('hiçbir şey taşımayan artışı tanır', () => {
    expect(isEmptyDelta(sanitizeDelta({}))).toBe(true)
    expect(isEmptyDelta(sanitizeDelta({ seconds: -5 }))).toBe(true)
    expect(isEmptyDelta(sanitizeDelta({ cards: 1 }))).toBe(false)
    expect(isEmptyDelta(sanitizeDelta({ xp: -10 }))).toBe(false)
  })
})

describe('applyDelta', () => {
  it('mevcut sayaçların üzerine ekler', () => {
    const totals = applyDelta(
      { ...EMPTY_TOTALS, studySeconds: 600, questionsAnswered: 5 },
      sanitizeDelta({ seconds: 300, questions: 7, cards: 2 }),
    )
    expect(totals).toEqual({
      studySeconds: 900,
      questionsAnswered: 12,
      cardsReviewed: 2,
      blocksCompleted: 0,
      videosCompleted: 0,
      xpEarned: 0,
    })
  })

  it('sayaçları negatife düşürmez ama XP toplamı negatife düşebilir', () => {
    const totals = applyDelta({ ...EMPTY_TOTALS, xpEarned: 10 }, sanitizeDelta({ xp: -30 }))
    expect(totals.xpEarned).toBe(-20)
    expect(totals.studySeconds).toBe(0)
  })
})

describe('meetsStreakThreshold', () => {
  it('seriyi yalnızca 15 dakikadan sonra ilerletir', () => {
    expect(meetsStreakThreshold({ ...EMPTY_TOTALS, studySeconds: STREAK_MIN_SECONDS - 1 })).toBe(
      false,
    )
    expect(meetsStreakThreshold({ ...EMPTY_TOTALS, studySeconds: STREAK_MIN_SECONDS })).toBe(true)
  })

  it('süre dışındaki sayaçlar tek başına eşiği geçirmez', () => {
    expect(meetsStreakThreshold({ ...EMPTY_TOTALS, cardsReviewed: 500 })).toBe(false)
  })
})
