/**
 * Canlı deneme geri sayımının saf biçimlendirmesi.
 *
 * "Şimdi" parametre olarak gelir; sayaç istemcide her tikte YENİDEN hesaplanır,
 * kendi kendine azalan bir sayaç tutulmaz. Sekme uyutulsa ya da tarayıcı
 * zamanlayıcıyı kıssa da kalan süre doğru kalır (test motorundaki
 * `remainingSeconds` ile aynı gerekçe).
 */

export type CountdownUnits = {
  day: string
  hour: string
  minute: string
  second: string
}

/** Hedefe kalan saniye. Hedef okunamıyorsa null, geçmişse 0. */
export function secondsUntil(target: string | null, now: number): number | null {
  if (typeof target !== 'string' || target.trim().length === 0) return null
  const at = Date.parse(target)
  if (Number.isNaN(at)) return null
  return Math.max(0, Math.ceil((at - now) / 1000))
}

/**
 * "2 g 5 sa" gibi okunur bir süre.
 *
 * EN FAZLA İKİ BİRİM gösterilir: "2 g 5 sa 13 dk 07 sn" kimse tarafından
 * okunmuyor. Bir dakikanın altında saniye tek başına gösterilir ki son anlar
 * hissedilsin.
 */
export function formatCountdown(seconds: number, units: CountdownUnits): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.trunc(seconds) : 0

  const days = Math.floor(safe / 86400)
  const hours = Math.floor((safe % 86400) / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const rest = safe % 60

  if (days > 0) return `${days} ${units.day} ${hours} ${units.hour}`
  if (hours > 0) return `${hours} ${units.hour} ${minutes} ${units.minute}`
  if (minutes > 0) return `${minutes} ${units.minute} ${rest} ${units.second}`
  return `${rest} ${units.second}`
}
