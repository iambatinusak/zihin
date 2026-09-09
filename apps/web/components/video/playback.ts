/**
 * Oynatıcının saf oynatma mantığı: konum kırpma, izleme süresi sayacı,
 * checkpoint tetikleme ve kısayol hesapları.
 *
 * İzleme süresi neden burada: sunucu istemcinin bildirdiği artışı kırpar
 * (`lib/video/progress.ts`), ama artışın doğru ÜRETİLMESİ istemcinin işidir.
 * İleri sarma izleme süresine sayılmamalıdır ve bu kural yalnızca burada
 * test edilebilir.
 */

/** ± düğmelerinin ve ok tuşlarının adımı (saniye). */
export const SEEK_STEP_SECONDS = 10

/** Ok tuşlarının ses adımı (0-1 aralığında). */
export const VOLUME_STEP = 0.1

/**
 * İki `timeupdate` arasında izleme sayılan en büyük fark (saniye).
 * Tarayıcı `timeupdate` olayını saniyede yaklaşık 4 kez tetikler; 2 saniyeden
 * büyük bir sıçrama oynatma değil atlamadır (kullanıcı sardı ya da sekme
 * uyudu). En yüksek hız 2x olduğu için normal oynatmada fark 2 saniyeyi aşmaz.
 */
export const MAX_TIMEUPDATE_DELTA_SECONDS = 2

/** İlerleme kaydının gönderilme aralığı (ms). */
export const PROGRESS_SAVE_INTERVAL_MS = 10_000

/** Videonun tamamlandı sayılması için izlenmesi gereken oran (spec §M3 AC). */
export const COMPLETION_FRACTION = 0.9

export type CheckpointMark = {
  id: string
  timestampSeconds: number
}

/** Konumu [0, süre] aralığına sıkıştırır. Süre bilinmiyorsa yalnızca negatifler temizlenir. */
export function clampTime(seconds: number, durationSeconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    return Math.min(seconds, durationSeconds)
  }
  return seconds
}

/** Ses düzeyini [0, 1] aralığına sıkıştırır. */
export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return 0
  return Math.min(1, Math.round(volume * 100) / 100)
}

/**
 * İki konum örneği arasında izleme sayılacak süre.
 *
 * Geri sarma (negatif fark) ve ileri atlama (eşikten büyük fark) 0 döner:
 * ileri sarma izleme süresine sayılmaz.
 */
export function watchedDelta(previousTime: number, currentTime: number): number {
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return 0
  const delta = currentTime - previousTime
  if (delta <= 0) return 0
  if (delta > MAX_TIMEUPDATE_DELTA_SECONDS) return 0
  return delta
}

/**
 * `previousTime` ile `currentTime` arasında geçilen, henüz tetiklenmemiş ilk
 * checkpoint. Yoksa null.
 *
 * Üç kural:
 *  - geriye gidişte hiçbir şey tetiklenmez (aynı soru tekrar sorulmaz),
 *  - ileri atlamada (eşikten büyük sıçrama) tetiklenmez; aksi hâlde tek bir
 *    atlamadan sonra sorular üst üste açılırdı,
 *  - aynı oturumda tetiklenmiş checkpoint bir daha açılmaz.
 */
export function dueCheckpoint<T extends CheckpointMark>(
  checkpoints: readonly T[],
  previousTime: number,
  currentTime: number,
  firedIds: ReadonlySet<string>,
): T | null {
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return null
  const delta = currentTime - previousTime
  if (delta <= 0 || delta > MAX_TIMEUPDATE_DELTA_SECONDS) return null

  let earliest: T | null = null
  for (const checkpoint of checkpoints) {
    const at = checkpoint.timestampSeconds
    if (firedIds.has(checkpoint.id)) continue
    if (at <= previousTime || at > currentTime) continue
    if (earliest === null || at < earliest.timestampSeconds) earliest = checkpoint
  }
  return earliest
}

/** `0`-`9` tuşları: videonun yüzde 0-90 aralığına atlar. */
export function percentSeekTarget(digit: number, durationSeconds: number): number {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return 0
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  return clampTime((durationSeconds * digit) / 10, durationSeconds)
}

/** ±10 saniye düğmelerinin ve ok tuşlarının hedef konumu. */
export function seekTarget(
  currentTime: number,
  offsetSeconds: number,
  durationSeconds: number,
): number {
  const base = Number.isFinite(currentTime) ? currentTime : 0
  return clampTime(base + offsetSeconds, durationSeconds)
}

/** Bir konumun süreye oranı, yüzde olarak (0-100). Süre bilinmiyorsa 0. */
export function toPercent(seconds: number, durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  const clamped = clampTime(seconds, durationSeconds)
  return (clamped / durationSeconds) * 100
}

/** Kaydırıcıda tıklanan yatay orana karşılık gelen konum. */
export function timeFromRatio(ratio: number, durationSeconds: number): number {
  if (!Number.isFinite(ratio) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  const safeRatio = Math.min(1, Math.max(0, ratio))
  return safeRatio * durationSeconds
}

/**
 * İzlenen toplam süre tamamlanma eşiğini geçti mi?
 * Süre bilinmiyorsa false — yanlışlıkla puan tetiklenmesin.
 */
export function hasReachedCompletion(watchedSeconds: number, durationSeconds: number): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false
  if (!Number.isFinite(watchedSeconds) || watchedSeconds <= 0) return false
  return watchedSeconds >= durationSeconds * COMPLETION_FRACTION
}

/** Kaynak bir HLS akışı mı? Uzantı `.m3u8` ise hls.js gerekir. */
export function isHlsSource(url: string): boolean {
  const withoutQuery = url.split('?')[0] ?? ''
  return withoutQuery.toLowerCase().endsWith('.m3u8')
}
