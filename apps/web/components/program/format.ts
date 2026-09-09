import { dayParts, weekDates } from '@/lib/plan/week'

/**
 * Tarih etiketleri. Gün ve ay adları BURADA YAZILI DEĞİL — sözlükten
 * (`i18n/tr/program.json`) dizi olarak gelir ve parametre olarak verilir.
 * Böylece bu dosya saf kalır, hem sunucu hem istemci bileşeni kullanabilir ve
 * çeviri tek kaynaktan okunur (CONVENTIONS §1).
 *
 * `Intl.DateTimeFormat` bilinçli olarak kullanılmadı: sunucu UTC'de, tarayıcı
 * kullanıcının saat diliminde çalışır ve aynı ISO tarih iki yerde farklı gün
 * gösterebilirdi. Etiket, tarihin kendi parçalarından üretilir.
 */

export type DateNames = {
  weekdayNames: string[]
  weekdayShort: string[]
  monthNames: string[]
}

function at(list: string[], index: number): string {
  return list[index] ?? ''
}

/** "Pazartesi" */
export function weekdayLabel(iso: string, names: DateNames): string {
  return at(names.weekdayNames, dayParts(iso).weekday - 1)
}

/** "Pzt" */
export function weekdayShortLabel(iso: string, names: DateNames): string {
  return at(names.weekdayShort, dayParts(iso).weekday - 1)
}

/** "12 Mayıs" */
export function dayLabel(iso: string, names: DateNames): string {
  const parts = dayParts(iso)
  return `${parts.day} ${at(names.monthNames, parts.month - 1)}`
}

/** "12 Mayıs 2025" */
export function fullDayLabel(iso: string, names: DateNames): string {
  return `${dayLabel(iso, names)} ${dayParts(iso).year}`
}

/**
 * Hafta aralığı: "12 – 18 Mayıs 2025".
 * Ay ya da yıl değişiyorsa iki uç da tam yazılır: "28 Nisan – 4 Mayıs 2025".
 */
export function weekRangeLabel(weekStart: string, names: DateNames): string {
  const days = weekDates(weekStart)
  const first = days[0]
  const last = days[6]
  if (!first || !last) return ''

  const a = dayParts(first)
  const b = dayParts(last)

  if (a.year !== b.year) return `${fullDayLabel(first, names)} – ${fullDayLabel(last, names)}`
  if (a.month !== b.month) {
    return `${dayLabel(first, names)} – ${dayLabel(last, names)} ${b.year}`
  }
  return `${a.day} – ${b.day} ${at(names.monthNames, b.month - 1)} ${b.year}`
}

/** "45 dk" gibi kısa süre etiketi. */
export function minutesLabel(minutes: number, unit: string): string {
  return `${Math.max(0, Math.round(minutes))} ${unit}`
}
