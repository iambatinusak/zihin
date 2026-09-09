/**
 * Program takviminin tarih aritmetiği — saf, bağımsız, test edilebilir.
 *
 * Referans saat dilimi Türkiye'dir (UTC+3, yaz saati yok); `@zihin/core`
 * `studyPlan.ts` ile AYNI kural. Sebep: sunucu UTC'de, tarayıcı kullanıcının
 * saat diliminde çalışır; ikisinin de "bugün"ü aynı gün olmalı, yoksa blok bir
 * gün kayar. Bu yüzden tarih hesabı `Date`'in yerel alanlarına (getDate,
 * getDay) hiç dokunmaz: her şey "gün numarası" tam sayısı üzerinden gider.
 *
 * Gün numarası = 1970-01-01'den bu yana geçen Türkiye günü (0 = 1 Ocak 1970).
 */

// Offset ve gün uzunluğu `lib/time/turkey.ts` içinde tanımlıdır; burada
// yeniden yazılmaz (dört kopyanın biri düzeltilip diğerleri unutuluyordu).
import { DAY_MS, TR_OFFSET_MS } from '@/lib/time/turkey'

/** "YYYY-MM-DD" biçimi. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type DayParts = {
  /** ISO hafta günü: 1 = Pazartesi ... 7 = Pazar. */
  weekday: number
  /** Ayın günü (1-31). */
  day: number
  /** Ay (1-12). */
  month: number
  year: number
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

/** Türkiye saatine göre gün numarası. */
export function toDayNumber(date: Date): number {
  return Math.floor((date.getTime() + TR_OFFSET_MS) / DAY_MS)
}

/** Gün numarasını "YYYY-MM-DD" biçimine çevirir. */
export function fromDayNumber(dayNumber: number): string {
  const date = new Date(dayNumber * DAY_MS)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

/** "YYYY-MM-DD" → gün numarası. Biçim bozuksa NaN döner. */
export function dayNumberOfIso(iso: string): number {
  if (!ISO_DATE_PATTERN.test(iso)) return Number.NaN
  const ms = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(ms)) return Number.NaN
  const dayNumber = Math.floor(ms / DAY_MS)
  // `Date.parse` takvimde olmayan günü taşırır: 2025-02-31 → 3 Mart. Gidiş
  // dönüş karşılaştırması bunu yakalar; aksi hâlde kullanıcı adres çubuğuna
  // yazdığı uydurma tarihle sessizce başka bir haftaya düşerdi.
  return fromDayNumber(dayNumber) === iso ? dayNumber : Number.NaN
}

export function isIsoDate(value: string): boolean {
  return !Number.isNaN(dayNumberOfIso(value))
}

/** ISO hafta günü: 1 = Pazartesi ... 7 = Pazar. */
export function isoWeekday(dayNumber: number): number {
  // 1970-01-01 Perşembe; +3 kaydırılır. Negatif gün numaralarında da doğru
  // çalışsın diye mod iki kez uygulanır.
  return ((((dayNumber + 3) % 7) + 7) % 7) + 1
}

/** Bugünün Türkiye tarihi. */
export function todayIso(now: Date = new Date()): string {
  return fromDayNumber(toDayNumber(now))
}

/** Verilen anın içinde bulunduğu haftanın Pazartesi'si. */
export function weekStartOf(date: Date): string {
  const dayNumber = toDayNumber(date)
  return fromDayNumber(dayNumber - (isoWeekday(dayNumber) - 1))
}

/** Verilen tarihin içinde bulunduğu haftanın Pazartesi'si. */
export function weekStartOfIso(iso: string): string {
  const dayNumber = dayNumberOfIso(iso)
  if (Number.isNaN(dayNumber)) return iso
  return fromDayNumber(dayNumber - (isoWeekday(dayNumber) - 1))
}

export function addDaysIso(iso: string, days: number): string {
  return fromDayNumber(dayNumberOfIso(iso) + days)
}

export function addWeeksIso(iso: string, weeks: number): string {
  return addDaysIso(iso, weeks * 7)
}

/** Haftanın yedi günü, Pazartesi'den Pazar'a. */
export function weekDates(weekStart: string): string[] {
  const start = dayNumberOfIso(weekStart)
  if (Number.isNaN(start)) return []
  return Array.from({ length: 7 }, (_, index) => fromDayNumber(start + index))
}

/** Tarih bu haftanın içinde mi? */
export function isInWeek(iso: string, weekStart: string): boolean {
  const day = dayNumberOfIso(iso)
  const start = dayNumberOfIso(weekStart)
  if (Number.isNaN(day) || Number.isNaN(start)) return false
  return day >= start && day <= start + 6
}

/** İki tarih arasındaki gün farkı (a - b). */
export function diffDays(a: string, b: string): number {
  return dayNumberOfIso(a) - dayNumberOfIso(b)
}

/**
 * Tarihi Türkiye gününün başlangıcına denk gelen bir `Date`'e çevirir.
 * `@zihin/core`'a girdi verirken kullanılır: core aynı ofseti uyguladığı için
 * gün numarası birebir korunur.
 */
export function toTurkeyDate(iso: string): Date {
  return new Date(dayNumberOfIso(iso) * DAY_MS - TR_OFFSET_MS)
}

/** Etiket üretimi için tarih parçaları. Ad/ay isimleri i18n'de, burada değil. */
export function dayParts(iso: string): DayParts {
  const dayNumber = dayNumberOfIso(iso)
  const date = new Date(dayNumber * DAY_MS)
  return {
    weekday: isoWeekday(dayNumber),
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  }
}
