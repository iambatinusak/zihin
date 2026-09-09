/**
 * Veli panelinin hafta aritmetiği ve karşılaştırma biçimlendirmesi.
 *
 * Saf: "şu an" her zaman parametredir, `Date.now()` çağrılmaz. Gün/hafta
 * hesabı `lib/plan/week.ts` üzerinden gider — takvim ile veli paneli aynı
 * Türkiye günü tanımını (UTC+3, yaz saati yok) paylaşmalı, yoksa aynı çalışma
 * iki ekranda farklı haftaya düşer.
 */

import { longDayLabel } from '@/lib/activity/day'
import {
  addDaysIso,
  addWeeksIso,
  dayNumberOfIso,
  isIsoDate,
  weekStartOf,
  weekStartOfIso,
} from '@/lib/plan/week'

export type WeekRange = {
  /** Haftanın Pazartesi'si (YYYY-MM-DD). */
  start: string
  /** Haftanın Pazar'ı (YYYY-MM-DD), dâhil. */
  end: string
}

/** Pazartesi–Pazar aralığı. Sorgular `gte(start)` / `lte(end)` ile kurulur. */
export function weekRange(weekStart: string): WeekRange {
  const start = weekStartOfIso(weekStart)
  return { start, end: addDaysIso(start, 6) }
}

/**
 * Haftanın zaman damgası aralığı: `[from, to)` — başlangıç dâhil, bitiş hariç.
 *
 * `timestamptz` kolonlar (attempts.answered_at, video_progress.completed_at)
 * tarihle değil anla karşılaştırılır. Sınırlar Türkiye gününün başına
 * sabitlenir (+03:00), sunucunun UTC oluşu haftayı üç saat kaydırmasın diye.
 */
export function weekInstantRange(weekStart: string): { from: string; to: string } {
  const { start, end } = weekRange(weekStart)
  return { from: `${start}T00:00:00+03:00`, to: `${addDaysIso(end, 1)}T00:00:00+03:00` }
}

/**
 * `?hafta=` parametresini haftaya çevirir.
 *
 * Kullanıcı adres çubuğunu düzenleyebilir: geçersiz ya da GELECEK bir hafta
 * sessizce bu haftaya kırpılır. Boş sayfa ya da hata ekranı gösterilmez —
 * veli için bu bir hata değil, yalnızca anlamsız bir istektir.
 */
export function resolveWeekStart(param: string | null | undefined, now: Date): string {
  const current = weekStartOf(now)
  if (typeof param !== 'string' || !isIsoDate(param)) return current

  const requested = weekStartOfIso(param)
  return dayNumberOfIso(requested) > dayNumberOfIso(current) ? current : requested
}

export function previousWeekStart(weekStart: string): string {
  return addWeeksIso(weekStartOfIso(weekStart), -1)
}

export function nextWeekStart(weekStart: string): string {
  return addWeeksIso(weekStartOfIso(weekStart), 1)
}

/** Bu haftadan ileri gidilemez; "sonraki hafta" düğmesi orada kapanır. */
export function canGoNextWeek(weekStart: string, now: Date): boolean {
  return dayNumberOfIso(weekStartOfIso(weekStart)) < dayNumberOfIso(weekStartOf(now))
}

/** "8 Eylül – 14 Eylül" — ay adları `lib/activity/day.ts` tablosundan gelir. */
export function weekRangeLabel(weekStart: string): string {
  const range = weekRange(weekStart)
  return `${longDayLabel(range.start)} – ${longDayLabel(range.end)}`
}

export function isCurrentWeek(weekStart: string, now: Date): boolean {
  return weekStartOfIso(weekStart) === weekStartOf(now)
}

/* ------------------------------------------------------------------------- *
 * Önceki hafta karşılaştırması
 * ------------------------------------------------------------------------- */

export type DeltaDirection = 'up' | 'down' | 'flat' | 'new' | 'none'

export type WeekDelta = {
  direction: DeltaDirection
  /** Yüzde değişim (tam sayı, mutlak değer). Oran anlamsızsa null. */
  percent: number | null
  /** Ham fark (current - previous). */
  difference: number
  /** "%12" gibi hazır metin; `direction` 'new'/'none' iken null. */
  text: string | null
}

/**
 * İki haftayı karşılaştırır.
 *
 * Sıfırdan büyümenin yüzdesi tanımsızdır (bölme sıfıra) — uydurma bir "%100"
 * yerine `new` döner ve arayüz "ilk kez" der. İki hafta da sıfırsa `none`:
 * hiç çalışılmamış bir haftaya "değişim yok" oku basmak yanıltıcı olurdu.
 */
export function weekDelta(current: number, previous: number): WeekDelta {
  const safeCurrent = Number.isFinite(current) ? current : 0
  const safePrevious = Number.isFinite(previous) ? previous : 0
  const difference = safeCurrent - safePrevious

  if (safePrevious === 0) {
    if (safeCurrent === 0) return { direction: 'none', percent: null, difference: 0, text: null }
    return { direction: 'new', percent: null, difference, text: null }
  }

  const percent = Math.round(Math.abs(difference / safePrevious) * 100)
  if (difference === 0 || percent === 0) {
    return { direction: 'flat', percent: 0, difference, text: '%0' }
  }

  return {
    direction: difference > 0 ? 'up' : 'down',
    percent,
    difference,
    text: `%${percent}`,
  }
}
