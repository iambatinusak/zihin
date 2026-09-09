/**
 * Para biçimlendirme ve karşılaştırma.
 *
 * Tutarlar Postgres'te `numeric(10,2)`; supabase-js bunu bazen `number`,
 * bazen `string` olarak döndürür (PostgREST numeric'i JSON'da kaybolmasın diye
 * metin verebilir). Bu yüzden okuma yolunda TEK bir dönüştürücü var.
 */

/** `numeric` kolonundan gelen değeri güvenli bir sayıya çevirir. */
export function toAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/** İki kuruş farkı bile fazla; kayan nokta toleransı 0,005 TL. */
const AMOUNT_EPSILON = 0.005

/** İki tutar aynı mı? Kayan nokta hatası için dar bir tolerans bırakır. */
export function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < AMOUNT_EPSILON
}

/** Sağlayıcıya gönderilen fiyat metni: her zaman iki ondalık, nokta ayraçlı. */
export function providerPrice(amount: number): string {
  return amount.toFixed(2)
}

const TRY_FORMATTER = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
})

const TRY_FORMATTER_WITH_KURUS = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Kullanıcıya gösterilen fiyat. Tam sayı tutarlarda kuruş yazılmaz
 * (2.490 ₺), kuruşlu tutarlarda yazılır (1.990,50 ₺).
 */
export function formatTry(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return Number.isInteger(rounded)
    ? TRY_FORMATTER.format(rounded)
    : TRY_FORMATTER_WITH_KURUS.format(rounded)
}

/** Aylık karşılık — "365 günde 2.490 ₺" yerine "ayda ~207 ₺". */
export function monthlyEquivalent(amount: number, durationDays: number): number | null {
  if (durationDays < 60) return null
  const months = durationDays / 30
  return Math.round(amount / months)
}
