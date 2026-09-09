import { describe, it, expect } from 'vitest'

import {
  computeXp,
  evaluateBadges,
  levelForXp,
  updateStreak,
  LEVEL_COUNT,
  XP_TABLE,
} from './gamification'
import type { BadgeContext, StreakProfile, XpReason } from './types'

// Testlerde asla goreli tarih kullanilmaz; hepsi sabit damgalardir.
const AT_09_TR = (isoDay: string): Date => new Date(`${isoDay}T09:00:00+03:00`)

function makeProfile(overrides: Partial<StreakProfile> = {}): StreakProfile {
  return { currentStreak: 0, longestStreak: 0, lastStudyDate: null, ...overrides }
}

function makeContext(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    videosCompleted: 0,
    testsCompleted: 0,
    currentStreak: 0,
    mocksCompleted: 0,
    cardsReviewed: 0,
    weakToStrongCount: 0,
    earnedBadges: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------

describe('XP_TABLE', () => {
  it('spec §M13 degerlerini birebir tasir', () => {
    expect(XP_TABLE).toEqual({
      video_completed: 20,
      test_completed: 10,
      correct_answer: 2,
      card_reviewed: 1,
      block_completed: 15,
      mock_completed: 50,
      placement_completed: 30,
    })
  })
})

describe('computeXp', () => {
  it('video tamamlama 20 XP verir', () => {
    expect(computeXp({ reason: 'video_completed' })).toBe(20)
  })

  it('test tamamlama 10 XP verir, dogru cevaplar ayrica sayilir', () => {
    expect(computeXp({ reason: 'test_completed' })).toBe(10)
    expect(computeXp({ reason: 'correct_answer', count: 12 })).toBe(24)
  })

  it('blok, deneme ve seviye belirleme odulleri', () => {
    expect(computeXp({ reason: 'block_completed' })).toBe(15)
    expect(computeXp({ reason: 'mock_completed' })).toBe(50)
    expect(computeXp({ reason: 'placement_completed' })).toBe(30)
  })

  it('count carpani kart tekrarinda uygulanir', () => {
    expect(computeXp({ reason: 'card_reviewed', count: 40 })).toBe(40)
  })

  it('count 0 verildiginde olay en az bir kez sayilir', () => {
    expect(computeXp({ reason: 'correct_answer', count: 0 })).toBe(2)
  })

  it('count undefined ise 1 kabul edilir', () => {
    expect(computeXp({ reason: 'correct_answer', count: undefined })).toBe(2)
    expect(computeXp({ reason: 'correct_answer' })).toBe(2)
  })

  it('negatif count 1 kabul edilir', () => {
    expect(computeXp({ reason: 'card_reviewed', count: -9 })).toBe(1)
  })

  it('tam sayi olmayan count (7.5) asagi yuvarlanir', () => {
    expect(computeXp({ reason: 'card_reviewed', count: 7.5 })).toBe(7)
    expect(computeXp({ reason: 'correct_answer', count: 7.5 })).toBe(14)
  })

  it('NaN count 1 kabul edilir', () => {
    expect(computeXp({ reason: 'video_completed', count: Number.NaN })).toBe(20)
    expect(computeXp({ reason: 'video_completed', count: Number.POSITIVE_INFINITY })).toBe(20)
  })

  it('tanimsiz bir olay turu 0 XP verir', () => {
    const unknownReason = 'bilinmeyen_olay' as string as XpReason
    expect(computeXp({ reason: unknownReason })).toBe(0)
  })

  it('sonuc her zaman negatif olmayan tam sayidir', () => {
    const reasons: XpReason[] = [
      'video_completed',
      'test_completed',
      'correct_answer',
      'card_reviewed',
      'block_completed',
      'mock_completed',
      'placement_completed',
    ]
    for (const reason of reasons) {
      const xp = computeXp({ reason, count: -1 })
      expect(xp).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(xp)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------

describe('levelForXp', () => {
  it('LEVEL_COUNT 50 olarak disari verilir', () => {
    expect(LEVEL_COUNT).toBe(50)
  })

  it('0 XP birinci seviyedir ve ilerleme 0 dir', () => {
    expect(levelForXp(0)).toEqual({
      level: 1,
      currentLevelXp: 0,
      nextLevelXp: 100,
      progress: 0,
    })
  })

  it('negatif XP 0 kabul edilir', () => {
    expect(levelForXp(-5000)).toEqual({
      level: 1,
      currentLevelXp: 0,
      nextLevelXp: 100,
      progress: 0,
    })
  })

  it('NaN XP 0 kabul edilir', () => {
    expect(levelForXp(Number.NaN).level).toBe(1)
    expect(levelForXp(Number.NaN).progress).toBe(0)
  })

  it('tam olarak 2. seviye esiginde (100 XP) seviye 2 baslar', () => {
    expect(levelForXp(100)).toEqual({
      level: 2,
      currentLevelXp: 100,
      nextLevelXp: 303,
      progress: 0,
    })
  })

  it('esigin bir altinda hala onceki seviyededir', () => {
    const info = levelForXp(99)
    expect(info.level).toBe(1)
    expect(info.progress).toBeCloseTo(0.99, 10)
  })

  it('seviye ortasinda ilerleme kesin olarak 0 ile 1 arasindadir', () => {
    const info = levelForXp(200)
    expect(info.level).toBe(2)
    expect(info.currentLevelXp).toBe(100)
    expect(info.nextLevelXp).toBe(303)
    expect(info.progress).toBeGreaterThan(0)
    expect(info.progress).toBeLessThan(1)
    expect(info.progress).toBeCloseTo(100 / 203, 10)
  })

  it('50. seviye esiginin hemen altinda tavan uygulanmaz', () => {
    const info = levelForXp(50_618)
    expect(info.level).toBe(49)
    expect(info.nextLevelXp).toBe(50_619)
    expect(info.progress).toBeGreaterThan(0)
    expect(info.progress).toBeLessThan(1)
  })

  it('50. seviye esiginde tavana ulasilir', () => {
    expect(levelForXp(50_619)).toEqual({
      level: 50,
      currentLevelXp: 50_619,
      nextLevelXp: null,
      progress: 1,
    })
  })

  it('50. seviye esiginin cok otesinde de seviye 50 ve ilerleme 1 kalir', () => {
    const info = levelForXp(9_999_999)
    expect(info.level).toBe(50)
    expect(info.nextLevelXp).toBeNull()
    expect(info.progress).toBe(1)
  })

  it('XP arttikca seviye asla dusmez (monotonluk)', () => {
    let previousLevel = 0
    let previousStart = -1
    for (let xp = 0; xp <= 60_000; xp += 91) {
      const info = levelForXp(xp)
      expect(info.level).toBeGreaterThanOrEqual(previousLevel)
      expect(info.currentLevelXp).toBeGreaterThanOrEqual(previousStart)
      expect(info.currentLevelXp).toBeLessThanOrEqual(xp)
      expect(info.progress).toBeGreaterThanOrEqual(0)
      expect(info.progress).toBeLessThanOrEqual(1)
      expect(info.level).toBeGreaterThanOrEqual(1)
      expect(info.level).toBeLessThanOrEqual(LEVEL_COUNT)
      previousLevel = info.level
      previousStart = info.currentLevelXp
    }
    expect(previousLevel).toBe(LEVEL_COUNT)
  })

  it('son seviye disinda nextLevelXp her zaman currentLevelXp den buyuktur', () => {
    for (let xp = 0; xp < 50_619; xp += 337) {
      const info = levelForXp(xp)
      expect(info.nextLevelXp).not.toBeNull()
      if (info.nextLevelXp !== null) {
        expect(info.nextLevelXp).toBeGreaterThan(info.currentLevelXp)
        expect(info.nextLevelXp).toBeGreaterThan(xp)
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('updateStreak', () => {
  it('ilk calisma serisi 1 den baslatir', () => {
    const result = updateStreak(makeProfile(), AT_09_TR('2026-03-02'))
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastStudyDate: '2026-03-02',
      incremented: true,
    })
  })

  it('ayni gun ikinci kez calismak seriyi degistirmez', () => {
    const profile = makeProfile({ currentStreak: 5, longestStreak: 9, lastStudyDate: '2026-03-02' })
    const result = updateStreak(profile, new Date('2026-03-02T21:45:00+03:00'))
    expect(result).toEqual({
      currentStreak: 5,
      longestStreak: 9,
      lastStudyDate: '2026-03-02',
      incremented: false,
    })
  })

  it('ardisik gun seriyi bir artirir', () => {
    const profile = makeProfile({ currentStreak: 5, longestStreak: 9, lastStudyDate: '2026-03-02' })
    const result = updateStreak(profile, AT_09_TR('2026-03-03'))
    expect(result).toEqual({
      currentStreak: 6,
      longestStreak: 9,
      lastStudyDate: '2026-03-03',
      incremented: true,
    })
  })

  it('en uzun seri gerektiginde guncellenir', () => {
    const profile = makeProfile({ currentStreak: 9, longestStreak: 9, lastStudyDate: '2026-03-02' })
    const result = updateStreak(profile, AT_09_TR('2026-03-03'))
    expect(result.currentStreak).toBe(10)
    expect(result.longestStreak).toBe(10)
  })

  it('2 gunluk bosluk seriyi 1 e sifirlar', () => {
    const profile = makeProfile({
      currentStreak: 12,
      longestStreak: 12,
      lastStudyDate: '2026-03-02',
    })
    const result = updateStreak(profile, AT_09_TR('2026-03-04'))
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 12,
      lastStudyDate: '2026-03-04',
      incremented: true,
    })
  })

  it('10 gunluk bosluk seriyi 1 e sifirlar ama rekoru korur', () => {
    const profile = makeProfile({
      currentStreak: 30,
      longestStreak: 41,
      lastStudyDate: '2026-03-02',
    })
    const result = updateStreak(profile, AT_09_TR('2026-03-12'))
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 41,
      lastStudyDate: '2026-03-12',
      incremented: true,
    })
  })

  it('son calismadan onceki bir tarih seriyi geriye almaz', () => {
    const profile = makeProfile({ currentStreak: 7, longestStreak: 7, lastStudyDate: '2026-03-05' })
    const result = updateStreak(profile, AT_09_TR('2026-03-02'))
    expect(result).toEqual({
      currentStreak: 7,
      longestStreak: 7,
      lastStudyDate: '2026-03-05',
      incremented: false,
    })
  })

  it('UTC gecesi Turkiye gunu degildir: 22:30Z zaten ertesi gundur', () => {
    const profile = makeProfile({ currentStreak: 3, longestStreak: 3, lastStudyDate: '2026-03-02' })
    const result = updateStreak(profile, new Date('2026-03-02T22:30:00Z'))
    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 4,
      lastStudyDate: '2026-03-03',
      incremented: true,
    })
  })

  it('20:30Z hala ayni Turkiye gunudur (23:30) ve seriyi artirmaz', () => {
    const profile = makeProfile({ currentStreak: 3, longestStreak: 3, lastStudyDate: '2026-03-02' })
    const result = updateStreak(profile, new Date('2026-03-02T20:30:00Z'))
    expect(result).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      lastStudyDate: '2026-03-02',
      incremented: false,
    })
  })

  it('Turkiye gun siniri tam olarak 21:00Z dir (+03, ne +02 ne +04)', () => {
    // 20:30Z / 22:30Z testleri sapmayi yalnizca [1.5s, 3.5s) araligina hapseder;
    // asagidaki cift, sinirin milisaniyesi milisaniyesine +03 oldugunu sabitler.
    const profile = makeProfile({ currentStreak: 3, longestStreak: 3, lastStudyDate: '2026-03-02' })

    const justBefore = updateStreak(profile, new Date('2026-03-02T20:59:59.999Z'))
    expect(justBefore).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      lastStudyDate: '2026-03-02',
      incremented: false,
    })

    const atBoundary = updateStreak(profile, new Date('2026-03-02T21:00:00.000Z'))
    expect(atBoundary).toEqual({
      currentStreak: 4,
      longestStreak: 4,
      lastStudyDate: '2026-03-03',
      incremented: true,
    })
  })

  it('00:30Z Turkiye de ayni gunun 03:30 udur, onceki gunun devami degildir', () => {
    const profile = makeProfile({ currentStreak: 2, longestStreak: 5, lastStudyDate: '2026-03-02' })
    const result = updateStreak(profile, new Date('2026-03-03T00:30:00Z'))
    expect(result.lastStudyDate).toBe('2026-03-03')
    expect(result.currentStreak).toBe(3)
    expect(result.incremented).toBe(true)
  })

  it('ay sinirini asan ardisik gunler seriyi surdurur', () => {
    const profile = makeProfile({ currentStreak: 4, longestStreak: 4, lastStudyDate: '2026-03-31' })
    const result = updateStreak(profile, AT_09_TR('2026-04-01'))
    expect(result).toEqual({
      currentStreak: 5,
      longestStreak: 5,
      lastStudyDate: '2026-04-01',
      incremented: true,
    })
  })

  it('subat sonu (2028 artik yil) ardisikligi dogru sayilir', () => {
    const profile = makeProfile({ currentStreak: 1, longestStreak: 1, lastStudyDate: '2028-02-28' })
    const result = updateStreak(profile, AT_09_TR('2028-02-29'))
    expect(result.currentStreak).toBe(2)
    expect(result.lastStudyDate).toBe('2028-02-29')
  })

  it('yil sinirini asan ardisik gunler seriyi surdurur', () => {
    const profile = makeProfile({
      currentStreak: 10,
      longestStreak: 12,
      lastStudyDate: '2026-12-31',
    })
    const result = updateStreak(profile, AT_09_TR('2027-01-01'))
    expect(result).toEqual({
      currentStreak: 11,
      longestStreak: 12,
      lastStudyDate: '2027-01-01',
      incremented: true,
    })
  })

  it('bozuk lastStudyDate ilk calisma gibi ele alinir', () => {
    const profile = makeProfile({ currentStreak: 8, longestStreak: 8, lastStudyDate: '02.03.2026' })
    const result = updateStreak(profile, AT_09_TR('2026-03-03'))
    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 8,
      lastStudyDate: '2026-03-03',
      incremented: true,
    })
  })

  it('gecersiz ay/gun iceren tarih anahtari da ilk calisma gibi ele alinir', () => {
    const profile = makeProfile({ currentStreak: 8, longestStreak: 8, lastStudyDate: '2026-13-40' })
    const result = updateStreak(profile, AT_09_TR('2026-03-03'))
    expect(result.currentStreak).toBe(1)
    expect(result.incremented).toBe(true)
  })

  it('gecersiz aktivite tarihi hicbir seyi degistirmez', () => {
    const profile = makeProfile({
      currentStreak: 6,
      longestStreak: 11,
      lastStudyDate: '2026-03-02',
    })
    const result = updateStreak(profile, new Date('gecersiz-tarih'))
    expect(result).toEqual({
      currentStreak: 6,
      longestStreak: 11,
      lastStudyDate: '2026-03-02',
      incremented: false,
    })
  })

  it('bozuk sayaclar negatif olmayan degerlere indirgenir', () => {
    const profile = makeProfile({
      currentStreak: -4,
      longestStreak: Number.NaN,
      lastStudyDate: '2026-03-02',
    })
    const result = updateStreak(profile, AT_09_TR('2026-03-03'))
    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(1)
  })

  it('ust uste 5 gun cagrildiginda seri dogrusal buyur', () => {
    let state = updateStreak(makeProfile(), AT_09_TR('2026-03-02'))
    const days = ['2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
    for (const day of days) {
      state = updateStreak(
        {
          currentStreak: state.currentStreak,
          longestStreak: state.longestStreak,
          lastStudyDate: state.lastStudyDate,
        },
        AT_09_TR(day),
      )
    }
    expect(state.currentStreak).toBe(5)
    expect(state.longestStreak).toBe(5)
    expect(state.lastStudyDate).toBe('2026-03-06')
  })
})

// ---------------------------------------------------------------------------

describe('evaluateBadges', () => {
  it('hicbir kosul saglanmadiginda bos dizi doner', () => {
    expect(evaluateBadges(makeContext())).toEqual([])
  })

  it('tum kosullar birden saglandiginda kural sirasiyla doner', () => {
    const context = makeContext({
      videosCompleted: 3,
      testsCompleted: 25,
      currentStreak: 45,
      mocksCompleted: 2,
      cardsReviewed: 500,
      weakToStrongCount: 4,
    })
    expect(evaluateBadges(context)).toEqual([
      'first_video',
      'ten_tests',
      'streak_7',
      'streak_30',
      'first_mock',
      'weak_to_strong',
      'hundred_cards',
    ])
  })

  it('zaten kazanilmis rozetler tekrar verilmez', () => {
    const context = makeContext({
      videosCompleted: 3,
      testsCompleted: 25,
      currentStreak: 45,
      mocksCompleted: 2,
      cardsReviewed: 500,
      weakToStrongCount: 4,
      earnedBadges: ['first_video', 'streak_7', 'hundred_cards'],
    })
    expect(evaluateBadges(context)).toEqual([
      'ten_tests',
      'streak_30',
      'first_mock',
      'weak_to_strong',
    ])
  })

  it('ilk video rozeti tek videoda kazanilir', () => {
    expect(evaluateBadges(makeContext({ videosCompleted: 1 }))).toEqual(['first_video'])
  })

  it('10 test esigi: 9 test yetmez, 10 test kazandirir', () => {
    expect(evaluateBadges(makeContext({ testsCompleted: 9 }))).toEqual([])
    expect(evaluateBadges(makeContext({ testsCompleted: 10 }))).toEqual(['ten_tests'])
  })

  it('7 gun seri esigi: 6 gun yetmez, 7 gun kazandirir', () => {
    expect(evaluateBadges(makeContext({ currentStreak: 6 }))).toEqual([])
    expect(evaluateBadges(makeContext({ currentStreak: 7 }))).toEqual(['streak_7'])
  })

  it('30 gun seri esiginde iki seri rozeti birden kazanilir', () => {
    expect(evaluateBadges(makeContext({ currentStreak: 29 }))).toEqual(['streak_7'])
    expect(evaluateBadges(makeContext({ currentStreak: 30 }))).toEqual(['streak_7', 'streak_30'])
  })

  it('100 kart esigi: 99 kart yetmez, 100 kart kazandirir', () => {
    expect(evaluateBadges(makeContext({ cardsReviewed: 99 }))).toEqual([])
    expect(evaluateBadges(makeContext({ cardsReviewed: 100 }))).toEqual(['hundred_cards'])
  })

  it('ilk deneme ve zayiftan gucluye rozetleri tek olayla kazanilir', () => {
    expect(evaluateBadges(makeContext({ mocksCompleted: 1 }))).toEqual(['first_mock'])
    expect(evaluateBadges(makeContext({ weakToStrongCount: 1 }))).toEqual(['weak_to_strong'])
    expect(evaluateBadges(makeContext({ mocksCompleted: 0, weakToStrongCount: 0 }))).toEqual([])
  })

  it('tum rozetler kazanilmissa yeni rozet donmez', () => {
    const context = makeContext({
      videosCompleted: 10,
      testsCompleted: 99,
      currentStreak: 120,
      mocksCompleted: 9,
      cardsReviewed: 4000,
      weakToStrongCount: 8,
      earnedBadges: [
        'first_video',
        'ten_tests',
        'streak_7',
        'streak_30',
        'first_mock',
        'weak_to_strong',
        'hundred_cards',
      ],
    })
    expect(evaluateBadges(context)).toEqual([])
  })
})
