import { turkeyDayWindow, type TurkeyDayWindow } from '@/lib/time/turkey'

// Gün penceresi artık `lib/time/turkey.ts` içinde; çağıranlar buradan da
// okumaya devam edebilsin diye yeniden dışa vurulur.
export { turkeyDayWindow }
export type { TurkeyDayWindow }

/**
 * Günlük soru sorma kotasının SAF kuralları (spec §M11).
 *
 * Neden burada: kota hem sunucudaki action'da zorlanıyor hem de arayüzde
 * "bugün kaç hakkın kaldı" olarak gösteriliyor. İki yerde iki farklı hesap
 * olmasın diye kural tek dosyada, testli ve saf duruyor. `Date.now()` yok;
 * "şimdi" her zaman parametredir (CONVENTIONS §5).
 */

/** Aboneliği olmayan (ya da paketi bir sayı vermeyen) öğrencinin hakkı. */
export const DEFAULT_DAILY_QUESTION_LIMIT = 3

/**
 * `packages.features` jsonb'sinden günlük soru limitini okur.
 *
 * Kolon değil jsonb alanı: 0009'daki paket tohumu limiti
 * `{"daily_question_limit":3,...}` içinde taşıyor. Sayı değilse, negatifse ya
 * da tam sayı değilse varsayılana düşülür — bozuk bir paket kaydı öğrencinin
 * hakkını sınırsıza çevirmemeli.
 */
export function readDailyQuestionLimit(features: unknown): number {
  if (features === null || typeof features !== 'object' || Array.isArray(features)) {
    return DEFAULT_DAILY_QUESTION_LIMIT
  }

  const raw = (features as Record<string, unknown>).daily_question_limit
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_DAILY_QUESTION_LIMIT

  const floored = Math.floor(raw)
  return floored >= 0 ? floored : DEFAULT_DAILY_QUESTION_LIMIT
}

/**
 * Birden fazla aktif abonelik varsa EN CÖMERT limit geçerlidir; öğrenci iki
 * paketin kesişiminde değil birleşiminde olmalı.
 */
export function bestDailyQuestionLimit(featuresList: readonly unknown[]): number {
  if (featuresList.length === 0) return DEFAULT_DAILY_QUESTION_LIMIT
  return featuresList.reduce<number>(
    (best, features) => Math.max(best, readDailyQuestionLimit(features)),
    0,
  )
}

export type QuotaState = {
  limit: number
  used: number
  remaining: number
  exhausted: boolean
}

/** Kalan hak. Kullanılan sayı limiti aşsa bile kalan asla negatif olmaz. */
export function quotaState(limit: number, used: number): QuotaState {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0
  const safeUsed = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0
  const remaining = Math.max(0, safeLimit - safeUsed)
  return { limit: safeLimit, used: safeUsed, remaining, exhausted: remaining === 0 }
}
