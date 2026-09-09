/**
 * @zihin/core — oyunlastirma motoru: XP, seviye, calisma serisi ve rozetler.
 *
 * Bu dosyada hicbir yan etki yoktur: "simdi" kavrami her zaman disaridan
 * parametre olarak gelir, boylece ayni girdi her ortamda ayni ciktiyi uretir.
 */

import type {
  BadgeCode,
  BadgeContext,
  LevelInfo,
  StreakProfile,
  StreakState,
  XpEvent,
  XpReason,
} from './types'

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

/**
 * Olay basina temel XP degerleri (spec §M13).
 *
 * `test_completed` sadece testi bitirme odulunu tasir; dogru cevaplarin ek
 * puani ayrica `correct_answer` olayi ile verilir, boylece testin disinda
 * cozulen sorular da ayni katsayidan yararlanir.
 */
export const XP_TABLE: Readonly<Record<XpReason, number>> = {
  video_completed: 20,
  test_completed: 10,
  correct_answer: 2,
  card_reviewed: 1,
  block_completed: 15,
  mock_completed: 50,
  placement_completed: 30,
}

/**
 * Adet bilgisini negatif olmayan tam sayiya indirger ve en az 1 yapar.
 *
 * Olay zaten gerceklesmis oldugu icin hatali/eksik `count` gonderen bir
 * cagriya sifir puan vermek kullanicinin aleyhine olur; taban odul korunur.
 */
function normalizeCount(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) return 1
  const whole = Math.floor(count)
  return whole < 1 ? 1 : whole
}

/** Bir XP olayinin kazandirdigi puan. Sonuc her zaman >= 0 tam sayidir. */
export function computeXp(event: XpEvent): number {
  const base: number | undefined = XP_TABLE[event.reason]
  if (base === undefined || !Number.isFinite(base)) return 0
  const xp = base * normalizeCount(event.count)
  return xp > 0 ? Math.floor(xp) : 0
}

// ---------------------------------------------------------------------------
// Seviye
// ---------------------------------------------------------------------------

/** Ust seviye siniri. */
export const LEVEL_COUNT = 50

/**
 * Ussel egri: 1.6 kuvveti, ilk seviyelerin hizli, ust seviyelerin belirgin
 * sekilde zor gecilmesini saglar (seviye 2 = 100 XP, seviye 50 = 50.619 XP).
 */
function levelThreshold(level: number): number {
  return Math.round(100 * (level - 1) ** 1.6)
}

function buildThresholds(): number[] {
  const thresholds: number[] = []
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    thresholds.push(levelThreshold(level))
  }
  return thresholds
}

/** Esikler modul yuklenirken bir kez hesaplanir; egri sabittir. */
const LEVEL_THRESHOLDS: readonly number[] = buildThresholds()

/** Toplam XP'den seviye ve seviye ici ilerleme. Negatif XP 0 sayilir. */
export function levelForXp(xp: number): LevelInfo {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0

  let level = 1
  for (let index = LEVEL_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    const threshold = LEVEL_THRESHOLDS[index]
    if (threshold !== undefined && safeXp >= threshold) {
      level = index + 1
      break
    }
  }

  const currentLevelXp = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextLevelXp = level >= LEVEL_COUNT ? undefined : LEVEL_THRESHOLDS[level]

  if (nextLevelXp === undefined) {
    return { level: LEVEL_COUNT, currentLevelXp, nextLevelXp: null, progress: 1 }
  }

  const span = nextLevelXp - currentLevelXp
  const raw = span > 0 ? (safeXp - currentLevelXp) / span : 0
  const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw

  return { level, currentLevelXp, nextLevelXp, progress }
}

// ---------------------------------------------------------------------------
// Seri (streak)
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000

/** Turkiye kalici olarak UTC+03'tur; yaz saati uygulamasi kaldirilmistir. */
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * UTC damgasina 3 saat ekleyip UTC alanlarini okumak, `toLocaleDateString`
 * gibi ortamin ICU verisine bagimli (ve testte kaygan) yollardan kacinmamizi
 * saglar.
 */
function toTurkeyClock(date: Date): Date {
  return new Date(date.getTime() + TURKEY_OFFSET_MS)
}

function pad(value: number, size: number): string {
  const text = String(Math.abs(value))
  return (
    (value < 0 ? '-' : '') + (text.length >= size ? text : '0'.repeat(size - text.length) + text)
  )
}

/** Turkiye saatine gore "YYYY-MM-DD". */
function turkeyDayKey(date: Date): string {
  const clock = toTurkeyClock(date)
  return `${pad(clock.getUTCFullYear(), 4)}-${pad(clock.getUTCMonth() + 1, 2)}-${pad(clock.getUTCDate(), 2)}`
}

/** Turkiye saatine gore gun sirasi; iki gun arasindaki farki cikarmayi saglar. */
function turkeyDayIndex(date: Date): number {
  return Math.floor(toTurkeyClock(date).getTime() / MS_PER_DAY)
}

function dayIndexFromKey(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (match === null) return null

  const yearPart = match[1]
  const monthPart = match[2]
  const dayPart = match[3]
  if (yearPart === undefined || monthPart === undefined || dayPart === undefined) return null

  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const ms = Date.UTC(year, month - 1, day)
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / MS_PER_DAY)
}

/** Profilden gelen sayaclari negatif olmayan tam sayiya indirger. */
function sanitizeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  const whole = Math.floor(value)
  return whole < 0 ? 0 : whole
}

/**
 * Calisma serisini gunceller. "Gun" sinirlari Turkiye saatine (UTC+03) gore
 * cizilir; ornegin 22:30 UTC zaten ertesi gundur.
 */
export function updateStreak(profile: StreakProfile, activityDate: Date): StreakState {
  const previousStreak = sanitizeCount(profile.currentStreak)
  const previousLongest = sanitizeCount(profile.longestStreak)
  const lastKey = profile.lastStudyDate

  const time = activityDate.getTime()
  if (!Number.isFinite(time)) {
    // Gecersiz tarih seriyi bozmamali: kullanicinin emegi bir veri hatasi
    // yuzunden silinmez, hicbir sey degistirilmez.
    return {
      currentStreak: previousStreak,
      longestStreak: Math.max(previousLongest, previousStreak),
      lastStudyDate: lastKey,
      incremented: false,
    }
  }

  const todayKey = turkeyDayKey(activityDate)
  const lastIndex = lastKey === null ? null : dayIndexFromKey(lastKey)

  let currentStreak: number
  let lastStudyDate: string | null
  let incremented: boolean

  if (lastIndex === null) {
    currentStreak = 1
    lastStudyDate = todayKey
    incremented = true
  } else {
    const diff = turkeyDayIndex(activityDate) - lastIndex
    if (diff === 1) {
      currentStreak = previousStreak + 1
      lastStudyDate = todayKey
      incremented = true
    } else if (diff > 1) {
      currentStreak = 1
      lastStudyDate = todayKey
      incremented = true
    } else {
      // diff === 0 (ayni gun) veya diff < 0 (saat kaymasi / geriye donuk kayit):
      // seri ne artar ne de geriye alinir.
      currentStreak = previousStreak
      lastStudyDate = lastKey
      incremented = false
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(previousLongest, currentStreak),
    lastStudyDate,
    incremented,
  }
}

// ---------------------------------------------------------------------------
// Rozetler
// ---------------------------------------------------------------------------

type BadgeRule = {
  code: BadgeCode
  isEarned: (context: BadgeContext) => boolean
}

/** Sira sabittir: rozet bildirimlerinin sirasi her calistirmada ayni olmali. */
const BADGE_RULES: readonly BadgeRule[] = [
  { code: 'first_video', isEarned: (c) => c.videosCompleted >= 1 },
  { code: 'ten_tests', isEarned: (c) => c.testsCompleted >= 10 },
  { code: 'streak_7', isEarned: (c) => c.currentStreak >= 7 },
  { code: 'streak_30', isEarned: (c) => c.currentStreak >= 30 },
  { code: 'first_mock', isEarned: (c) => c.mocksCompleted >= 1 },
  { code: 'weak_to_strong', isEarned: (c) => c.weakToStrongCount >= 1 },
  { code: 'hundred_cards', isEarned: (c) => c.cardsReviewed >= 100 },
]

/** Yalnizca YENI kazanilan rozet kodlarini kural sirasiyla doner. */
export function evaluateBadges(context: BadgeContext): BadgeCode[] {
  const already = new Set<BadgeCode>(context.earnedBadges ?? [])
  const earned: BadgeCode[] = []

  for (const rule of BADGE_RULES) {
    if (already.has(rule.code)) continue
    if (rule.isEarned(context)) earned.push(rule.code)
  }

  return earned
}
