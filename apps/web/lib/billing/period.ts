/**
 * Abonelik dönemi hesabı — saf fonksiyonlar, referans tarihi parametredir
 * (CONVENTIONS §5). Bu dosya Supabase, React ya da Next.js tanımaz.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Bitiş uyarısının kaç gün önce yazılacağı (spec §M14). */
export const SUBSCRIPTION_WARNING_DAYS = 7

export type SubscriptionPeriod = {
  startsAt: string
  endsAt: string
}

/**
 * Paket süresinden abonelik dönemini üretir.
 *
 * Bitiş `starts_at + duration_days`; `subscriptions_period_check` kısıtı
 * `ends_at > starts_at` istediği için süre en az bir gün olmalıdır — paket
 * kısıtı (`duration_days > 0`) bunu zaten garanti eder, burada yine de
 * savunmacı davranılır.
 */
export function subscriptionPeriod(startsAt: Date, durationDays: number): SubscriptionPeriod {
  const days = Math.max(1, Math.floor(durationDays))
  const start = new Date(startsAt.getTime())
  const end = new Date(start.getTime() + days * DAY_MS)
  return { startsAt: start.toISOString(), endsAt: end.toISOString() }
}

/**
 * Var olan bir aboneliğin üzerine ekleme yapar.
 *
 * Aktif aboneliği olan biri yeni paket alırsa süre baştan başlamaz, mevcut
 * bitişin üstüne eklenir — ödediği günü kaybetmesin.
 */
export function extendedPeriod(
  currentEndsAt: string | null,
  durationDays: number,
  now: Date,
): SubscriptionPeriod {
  const current = currentEndsAt ? new Date(currentEndsAt) : null
  const validFuture =
    current !== null && !Number.isNaN(current.getTime()) && current.getTime() > now.getTime()
  return subscriptionPeriod(validFuture ? (current as Date) : now, durationDays)
}

/**
 * Abonelik `now` ile `now + days` arasında mı bitiyor?
 *
 * Aralık (now, now + days] — HÂLÂ GEÇERLİ ama yakında bitecek olanlar. Zaten
 * bitmiş olan uyarı almaz, o `expired` işaretlenir.
 */
export function endsWithinDays(endsAt: string, now: Date, days: number): boolean {
  const end = new Date(endsAt).getTime()
  if (Number.isNaN(end)) return false
  const from = now.getTime()
  const to = from + days * DAY_MS
  return end > from && end <= to
}

/** Uyarı sorgusunun sınırları; `gt(from) / lte(to)` olarak kullanılır. */
export function warningWindow(now: Date, days = SUBSCRIPTION_WARNING_DAYS) {
  return {
    fromIso: now.toISOString(),
    toIso: new Date(now.getTime() + days * DAY_MS).toISOString(),
  }
}

/** Bitişe kalan tam gün sayısı; bugün bitiyorsa 0. Geçmişte ise negatif. */
export function daysUntil(endsAt: string, now: Date): number {
  const end = new Date(endsAt).getTime()
  if (Number.isNaN(end)) return 0
  return Math.floor((end - now.getTime()) / DAY_MS)
}
