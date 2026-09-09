/**
 * Bildirim zaman etiketi — saf ve test edilebilir.
 *
 * Fonksiyon METİN ÜRETMEZ, birim üretir; Türkçe karşılıklar sözlükten gelir
 * (`i18n/tr/notifications.json` → `notifications.time.*`). Böylece "2 saat önce"
 * ifadesi koda gömülmez ve ikinci bir dil eklendiğinde bu dosya değişmez.
 *
 * `now` PARAMETREDİR: sunucuda render edilen bir liste ile testin aynı sonucu
 * vermesi için zaman dışarıdan verilir (CONVENTIONS §5 ile aynı gerekçe).
 */

export type RelativeTime =
  | { kind: 'now' }
  | { kind: 'minute'; value: number }
  | { kind: 'hour'; value: number }
  | { kind: 'day'; value: number }
  | { kind: 'date'; value: Date }

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** 7 günden eskisi göreli değil, tarih olarak yazılır. */
export const RELATIVE_LIMIT_DAYS = 7

export function relativeTime(iso: string, now: Date = new Date()): RelativeTime {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return { kind: 'date', value: now }

  // Gelecek zaman damgası (saat kayması) "az önce" sayılır; negatif sayı yazmayız.
  const diff = Math.max(0, now.getTime() - then.getTime())

  if (diff < MINUTE) return { kind: 'now' }
  if (diff < HOUR) return { kind: 'minute', value: Math.floor(diff / MINUTE) }
  if (diff < DAY) return { kind: 'hour', value: Math.floor(diff / HOUR) }

  const days = Math.floor(diff / DAY)
  if (days <= RELATIVE_LIMIT_DAYS) return { kind: 'day', value: days }

  return { kind: 'date', value: then }
}

export type RelativeTimeStrings = {
  now: string
  minutes: string
  hours: string
  days: string
}

/** Türkiye saatiyle "9 Eylül 2026" biçimi. */
export function formatAbsoluteDate(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date)
}

/** `{n}` yer tutucusunu dolduran küçük biçimlendirici. */
export function formatRelativeTime(value: RelativeTime, strings: RelativeTimeStrings): string {
  switch (value.kind) {
    case 'now':
      return strings.now
    case 'minute':
      return strings.minutes.replace('{n}', String(value.value))
    case 'hour':
      return strings.hours.replace('{n}', String(value.value))
    case 'day':
      return strings.days.replace('{n}', String(value.value))
    case 'date':
      return formatAbsoluteDate(value.value)
  }
}
