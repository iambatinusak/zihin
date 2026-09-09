/**
 * "Gün" kavramının uygulama tarafındaki gösterim yardımcıları.
 *
 * Türkiye günü tanımı burada DEĞİL, `lib/time/turkey.ts` içindedir; bu modül
 * onu yeniden dışa vurur ve üstüne yalnızca etiket/liste yardımcıları ekler.
 *
 * Saf: `Date.now()` çağrılmaz, "şu an" her zaman parametredir.
 */

import { DAY_MS, toMillis, turkeyDayKey } from '@/lib/time/turkey'

export { turkeyDayKey }

/**
 * Bugün dâhil son `count` günün anahtarları, ESKİDEN YENİYE.
 * Haftalık çalışma grafiği bu listeyi iskelet olarak kullanır: veri olmayan
 * gün de sütun olarak görünür, aksi hâlde grafik "çalışılmayan gün" ile
 * "kayıt yok"u ayırt edemezdi.
 */
export function lastDayKeys(now: Date | string | number, count: number): string[] {
  const ms = toMillis(now)
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  if (ms === null || safeCount === 0) return []

  const keys: string[] = []
  for (let offset = safeCount - 1; offset >= 0; offset -= 1) {
    keys.push(turkeyDayKey(ms - offset * DAY_MS))
  }
  return keys
}

/**
 * ISO gün anahtarının Türkçe kısa gün adı (Pzt, Sal ...).
 * Etiket `Intl` ile değil sabit tabloyla üretilir: doğrulama koşumu SQL_ASCII
 * yerel ayarıyla çalışıyor ve sunucu yereli garanti değil (CONVENTIONS §7).
 */
const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'] as const

export function weekdayLabel(dayKey: string): string {
  const ms = Date.parse(`${dayKey}T00:00:00Z`)
  if (!Number.isFinite(ms)) return ''
  return WEEKDAY_LABELS[new Date(ms).getUTCDay()] ?? ''
}

/** Gün anahtarının "9 Eylül" biçiminde uzun etiketi (erişilebilir metin için). */
const MONTH_LABELS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const

export function longDayLabel(dayKey: string): string {
  const ms = Date.parse(`${dayKey}T00:00:00Z`)
  if (!Number.isFinite(ms)) return dayKey
  const date = new Date(ms)
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()] ?? ''}`.trim()
}
