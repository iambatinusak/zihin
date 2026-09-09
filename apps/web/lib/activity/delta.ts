/**
 * Günlük aktivite sayaçlarının saf aritmetiği.
 *
 * `daily_activity` sayaçları YALNIZCA ARTAR (şemadaki `>= 0` kısıtları bunu
 * söylüyor). Negatif ya da saçma bir artış tabloyu kirletmesin diye girdi
 * burada temizlenir; yazma katmanı (`record.ts`) yalnızca sonucu uygular.
 */

/** Bir aktivite kaydının artışları. Verilmeyen alan 0 sayılır. */
export type StudyActivityDelta = {
  /** Geçirilen süre (saniye). */
  seconds?: number
  /** Cevaplanan soru sayısı. */
  questions?: number
  /** Tekrar edilen kart sayısı. */
  cards?: number
  /** Tamamlanan program bloğu sayısı. */
  blocks?: number
  /** Tamamlanan video sayısı. */
  videos?: number
  /** Kazanılan XP. Düzeltme olabileceği için NEGATİF de olabilir. */
  xp?: number
}

/** `daily_activity` satırının sayaç alanları. */
export type ActivityTotals = {
  studySeconds: number
  questionsAnswered: number
  cardsReviewed: number
  blocksCompleted: number
  videosCompleted: number
  xpEarned: number
}

export const EMPTY_TOTALS: ActivityTotals = {
  studySeconds: 0,
  questionsAnswered: 0,
  cardsReviewed: 0,
  blocksCompleted: 0,
  videosCompleted: 0,
  xpEarned: 0,
}

/**
 * Serinin ilerlemesi için o gün gereken en az çalışma süresi: 15 dakika
 * (spec §M13). Eşiği SUNUCU ölçer — istemciden gelen bir "bugün çalıştım"
 * bildirimi seriyi tek başına ilerletemez.
 */
export const STREAK_MIN_SECONDS = 15 * 60

/**
 * Tek bir günde makul üst sınır: 16 saat. Bunun üzerindeki bir artış ya hatalı
 * bir ölçüm ya da açık bırakılmış bir sekmedir; sayaç kırpılır.
 */
export const MAX_SECONDS_PER_CALL = 16 * 60 * 60

/** Negatif, kesirli ve NaN değerleri ayıklar. */
export function sanitizeDelta(delta: StudyActivityDelta): Required<StudyActivityDelta> {
  return {
    seconds: clampCount(delta.seconds, MAX_SECONDS_PER_CALL),
    questions: clampCount(delta.questions),
    cards: clampCount(delta.cards),
    blocks: clampCount(delta.blocks),
    videos: clampCount(delta.videos),
    xp: Number.isFinite(delta.xp) ? Math.trunc(delta.xp as number) : 0,
  }
}

/** Artışın gerçekten bir şey taşıyıp taşımadığı; boşsa yazma yapılmaz. */
export function isEmptyDelta(delta: Required<StudyActivityDelta>): boolean {
  return (
    delta.seconds === 0 &&
    delta.questions === 0 &&
    delta.cards === 0 &&
    delta.blocks === 0 &&
    delta.videos === 0 &&
    delta.xp === 0
  )
}

/** Mevcut sayaçların üzerine artışı ekler. */
export function applyDelta(
  current: ActivityTotals,
  delta: Required<StudyActivityDelta>,
): ActivityTotals {
  return {
    studySeconds: nonNegative(current.studySeconds + delta.seconds),
    questionsAnswered: nonNegative(current.questionsAnswered + delta.questions),
    cardsReviewed: nonNegative(current.cardsReviewed + delta.cards),
    blocksCompleted: nonNegative(current.blocksCompleted + delta.blocks),
    videosCompleted: nonNegative(current.videosCompleted + delta.videos),
    // xp_earned bilerek negatife düşebilir (bkz. şema yorumu): XP düzeltmeleri
    // günlük toplamı aşağı çekebilmeli.
    xpEarned: Math.trunc(current.xpEarned + delta.xp),
  }
}

/** O günkü toplam süre seriyi ilerletmeye yetiyor mu? */
export function meetsStreakThreshold(totals: ActivityTotals): boolean {
  return totals.studySeconds >= STREAK_MIN_SECONDS
}

function clampCount(value: number | undefined, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return 0
  const floored = Math.floor(value as number)
  if (floored <= 0) return 0
  return floored > max ? max : floored
}

function nonNegative(value: number): number {
  return value > 0 ? Math.trunc(value) : 0
}
