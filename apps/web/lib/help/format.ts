/**
 * Soru Çözücü'nün tarih ve metin biçimleyicileri.
 *
 * `Intl` KULLANILMAZ: sunucunun yerel ayarı garanti değil ve doğrulama koşumu
 * SQL_ASCII/C ile çalışıyor (CONVENTIONS §7). Aylar sabit tabloyla yazılır,
 * saat Türkiye saatine çevrilir (offset `lib/time/turkey.ts`) — kullanıcıya gösterilen her zaman
 * tıpkı `public.tr_today()` gibi Türkiye saatidir.
 */

import { TR_OFFSET_MS } from '@/lib/time/turkey'

const MONTHS = [
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

/** "9 Eylül 2026, 14:35" — Türkiye saatiyle. Geçersiz girdide boş metin. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return ''
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(ms)) return ''

  const date = new Date(ms + TR_OFFSET_MS)
  const day = date.getUTCDate()
  const month = MONTHS[date.getUTCMonth()] ?? ''
  const year = date.getUTCFullYear()
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')

  return `${day} ${month} ${year}, ${hour}:${minute}`
}

/** Bekleme süresi: "3 saat", "2 gün", "az önce". */
export function formatWaiting(from: string | number | Date, now: Date = new Date()): string {
  const startMs = from instanceof Date ? from.getTime() : new Date(from).getTime()
  if (!Number.isFinite(startMs)) return ''

  const minutes = Math.floor((now.getTime() - startMs) / 60000)
  if (minutes < 1) return 'az önce'
  if (minutes < 60) return `${minutes} dakika`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} saat`
  return `${Math.floor(hours / 24)} gün`
}

/** Liste satırı için tek satırlık önizleme. */
export function previewText(body: string | null, fallback: string, maxLength = 160): string {
  const text = (body ?? '').replace(/\s+/g, ' ').trim()
  if (text === '') return fallback
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}
