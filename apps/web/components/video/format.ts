/**
 * Oynatıcının saf biçimlendiricileri.
 *
 * Buradaki hiçbir fonksiyon DOM'a, isteğe ya da sistem saatine bakmaz; hepsi
 * `format.test.ts` ile ölçülür. Docker olmadan gerçek oynatma denenemediği
 * için oynatıcının doğrulanabilir yüzeyi bu dosya ve `playback.ts` dosyasıdır.
 */

/** Oynatıcının sunduğu hızlar (spec §M3). */
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const

export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

function safeSeconds(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * Sayaç biçimi: bir saatin altında `dd:ss`, üstünde `s:dd:ss`.
 * Geçersiz ve negatif değerler 0 sayılır.
 */
export function formatClock(totalSeconds: number): string {
  const safe = safeSeconds(totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/**
 * Ekran okuyucuya okunan süre: "3 dakika 12 saniye".
 * Sayaç biçimi ("3:12") harf harf okunduğu için kaydırıcının `aria-valuetext`
 * değeri sözel biçimi kullanır.
 */
export function formatSpokenTime(totalSeconds: number): string {
  const safe = safeSeconds(totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} saat`)
  if (minutes > 0) parts.push(`${minutes} dakika`)
  // Saniye yalnızca sıfırdan büyükse ya da başka hiçbir parça yoksa yazılır:
  // "1 dakika 0 saniye" yerine "1 dakika" okunur.
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} saniye`)
  return parts.join(' ')
}

/** Hız etiketi Türkçe ondalık ayırıcıyla yazılır: 0,75 · 1 · 1,25. */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '1'
  const rounded = Math.round(rate * 100) / 100
  return String(rounded).replace('.', ',')
}
