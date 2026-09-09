/**
 * TÜRKİYE SAATİNİN TEK KAYNAĞI.
 *
 * Türkiye kalıcı olarak UTC+3'tür; yaz saati uygulaması 2016'da kaldırıldı ve
 * geri gelmedi. Bu cümle depoda bir kez, burada yazılır — offset sabiti dört
 * ayrı modülde (activity/day, help/limits, help/format, mastery/timeline)
 * kopyalanmıştı ve birinde düzeltilen bir hata diğer üçünde kalıyordu.
 * Veritabanı tarafındaki karşılığı `public.tr_today()` (CONVENTIONS §6).
 *
 * Saf: `Date.now()` çağrılmaz, "şu an" her zaman parametredir. `Intl`
 * kullanılmaz — sunucunun yerel ayarı ve doğrulama koşumunun SQL_ASCII/C
 * ortamı garanti değildir (CONVENTIONS §7).
 */

/** UTC+3, sabit. Yaz saati yok. */
export const TR_OFFSET_MS = 3 * 60 * 60 * 1000

export const DAY_MS = 24 * 60 * 60 * 1000

const WEEK_MS = 7 * DAY_MS

/** Girdiyi milisaniyeye indirger; geçersizse null. */
export function toMillis(value: Date | string | number): number | null {
  const ms =
    value instanceof Date
      ? value.getTime()
      : typeof value === 'number'
        ? value
        : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * Bir anın ait olduğu Türkiye gününü ISO tarih (YYYY-MM-DD) olarak verir.
 * Geçersiz tarihte boş metin döner — çağıran kaydı sessizce atlayabilsin diye.
 */
export function turkeyDayKey(value: Date | string | number): string {
  const ms = toMillis(value)
  if (ms === null) return ''
  return new Date(ms + TR_OFFSET_MS).toISOString().slice(0, 10)
}

export type TurkeyDayWindow = {
  /** Gün anahtarı (YYYY-MM-DD), `public.tr_today()` ile aynı gün. */
  dayKey: string
  /** Günün başlangıcı, UTC ISO — sorguda `>= startIso` olarak kullanılır. */
  startIso: string
  /** Ertesi günün başlangıcı, UTC ISO — sorguda `< endIso`. */
  endIso: string
}

/**
 * Bir anın ait olduğu TÜRKİYE gününün UTC sınırlarını verir.
 *
 * `created_at` kolonu `timestamptz` (yani UTC) olduğu için sayım UTC aralığıyla
 * yapılır; aralığın kendisi Türkiye gününden türetilir. Böylece gece 00:30'da
 * (TR) yapılan bir işlem "dün"e değil bugüne sayılır.
 */
export function turkeyDayWindow(now: Date | string | number): TurkeyDayWindow {
  const dayKey = turkeyDayKey(now)
  if (dayKey === '') {
    // Geçersiz tarih: hiçbir satırı kapsamayan bir aralık döner, sayım 0 olur.
    const epoch = new Date(0).toISOString()
    return { dayKey: '', startIso: epoch, endIso: epoch }
  }

  const startMs = Date.parse(`${dayKey}T00:00:00Z`) - TR_OFFSET_MS
  return {
    dayKey,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + DAY_MS).toISOString(),
  }
}

/**
 * Bir anın ait olduğu haftanın PAZARTESİsini ISO tarih olarak verir.
 * Hafta ISO-8601'e göre pazartesi başlar; sınır Türkiye saatiyle çizilir.
 * Geçersiz tarihte boş metin.
 */
export function turkeyWeekStartKey(value: Date | string | number): string {
  const ms = toMillis(value)
  if (ms === null) return ''

  const shifted = new Date(ms + TR_OFFSET_MS)
  // getUTCDay: 0 = Pazar. Pazartesiyi 0 kabul edecek şekilde kaydırılır.
  const weekday = (shifted.getUTCDay() + 6) % 7
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
  return new Date(midnight - weekday * DAY_MS).toISOString().slice(0, 10)
}

export type TurkeyWeekWindow = {
  /** Haftanın pazartesisi (YYYY-MM-DD), Türkiye saatine göre. */
  weekStart: string
  /** Haftanın pazarı (YYYY-MM-DD) — `date` kolonuyla `<=` karşılaştırması için. */
  weekEnd: string
  /** Pazartesi 00:00 TR'nin UTC ISO karşılığı — `timestamptz` sorguları için. */
  startIso: string
  /** Sonraki pazartesi 00:00 TR'nin UTC ISO karşılığı (dışlayıcı üst sınır). */
  endIso: string
}

/**
 * İçinde bulunulan Türkiye haftasının sınırları. Liderlik tablosu her
 * pazartesi 00:00 TR'de sıfırlanır (spec §M13); sıfırlanmanın tanımı budur.
 */
export function turkeyWeekWindow(now: Date | string | number): TurkeyWeekWindow {
  const weekStart = turkeyWeekStartKey(now)
  if (weekStart === '') {
    const epoch = new Date(0).toISOString()
    return { weekStart: '', weekEnd: '', startIso: epoch, endIso: epoch }
  }

  const startMs = Date.parse(`${weekStart}T00:00:00Z`) - TR_OFFSET_MS
  return {
    weekStart,
    weekEnd: new Date(Date.parse(`${weekStart}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10),
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + WEEK_MS).toISOString(),
  }
}
