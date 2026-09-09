/**
 * Video ilerlemesinin saf mantığı.
 *
 * Bu dosya Next.js, React ya da Supabase tanımaz: girdi alır, hesaplar, çıktı
 * döner. Docker olmadan veritabanı ayağa kalkmadığı için izleme sayacının
 * doğruluğu yalnızca burada test edilebilir; action katmanı bu fonksiyonların
 * sonucunu yazmaktan başka bir şey yapmaz.
 */

/** Tek bir çağrıda kabul edilen en fazla izleme artışı (saniye). */
export const MAX_WATCH_DELTA_SECONDS = 60

/** Videonun "tamamlandı" sayılması için izlenmesi gereken oran (spec §M3 AC). */
export const COMPLETION_THRESHOLD = 0.9

export type VideoProgressState = {
  lastPositionSeconds: number
  watchTimeSeconds: number
  completedAt: string | null
}

export type ProgressUpdate = {
  positionSeconds: number
  watchedDeltaSeconds: number
}

/**
 * İstemciden gelen izleme artışını sınırlar.
 *
 * Neden: `watch_time_seconds` çalışma süresi raporlarını ve veli panelini
 * besliyor. Oynatıcı ilerlemeyi ~15 saniyede bir gönderir; tek çağrıda 60
 * saniyeden fazla artış ancak sekme uykuya daldığında ya da istemci kurcalandığında
 * oluşur. İkisinde de sayacı şişirmektense üst sınırda kesmek doğrudur.
 */
export function clampWatchDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0
  return Math.min(Math.floor(deltaSeconds), MAX_WATCH_DELTA_SECONDS)
}

/**
 * Konum değerini videonun süresine sıkıştırır. Süre bilinmiyorsa (0) yalnızca
 * negatif değerler temizlenir.
 */
export function clampPosition(positionSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(positionSeconds) || positionSeconds <= 0) return 0
  const whole = Math.floor(positionSeconds)
  if (durationSeconds > 0) return Math.min(whole, Math.floor(durationSeconds))
  return whole
}

/**
 * Önceki ilerleme + yeni konum/artış → yazılacak sonraki durum.
 * `previous` null ise kullanıcı videoyu ilk kez açmıştır.
 */
export function nextProgress(
  previous: VideoProgressState | null,
  update: ProgressUpdate,
  durationSeconds: number,
): VideoProgressState {
  const priorWatch =
    previous && Number.isFinite(previous.watchTimeSeconds)
      ? Math.max(0, Math.floor(previous.watchTimeSeconds))
      : 0

  return {
    lastPositionSeconds: clampPosition(update.positionSeconds, durationSeconds),
    watchTimeSeconds: priorWatch + clampWatchDelta(update.watchedDeltaSeconds),
    // Tamamlanma damgasını yalnızca completeVideo() atar; ilerleme kaydı
    // mevcut damgayı asla silmez ya da yeniden yazmaz.
    completedAt: previous?.completedAt ?? null,
  }
}

/**
 * Videonun tamamlanma eşiğini (süresinin %90'ı) geçip geçmediği.
 * Süre bilinmiyorsa eşik hesaplanamaz; kullanıcı lehine değil, aleyhine
 * karar verilir (false) — yanlışlıkla puan dağıtmamak için.
 */
export function hasCrossedCompletionThreshold(
  state: Pick<VideoProgressState, 'lastPositionSeconds' | 'watchTimeSeconds'>,
  durationSeconds: number,
): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false
  const required = durationSeconds * COMPLETION_THRESHOLD
  // İleri sarmayla da tamamlanabilsin diye konum yeterlidir; ama gerçekten
  // izleyen kullanıcı için toplam izleme süresi de tek başına eşiği geçirir.
  return state.lastPositionSeconds >= required || state.watchTimeSeconds >= required
}

/** Zaten tamamlanmış bir video için completeVideo() tekrar puan vermemelidir. */
export function isAlreadyCompleted(previous: VideoProgressState | null): boolean {
  return Boolean(previous?.completedAt)
}
