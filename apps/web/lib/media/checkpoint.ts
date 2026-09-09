/**
 * Video durağı (checkpoint) zaman doğrulaması (spec §M15).
 *
 * İki kural var ve ikisi de saf:
 *  1. Zaman videonun içinde olmalı. Süresi 600 sn olan bir videoda 700. saniye
 *     hiç görünmez; oraya konan soru öğrenciye asla çıkmaz.
 *  2. İki durak aynı saniyeyi paylaşamaz — veritabanındaki
 *     `video_checkpoints_video_timestamp_key` (unique (video_id,
 *     timestamp_seconds)) kısıtı. Kısıtın uygulama tarafındaki karşılığı
 *     burada; editör Postgres hatası değil, alan altında Türkçe bir uyarı
 *     görsün.
 */

export type CheckpointValidationInput = {
  timestampSeconds: number
  /** Videonun toplam süresi. 0 ise süre henüz girilmemiştir. */
  durationSeconds: number
  /** Bu videodaki mevcut durakların saniyeleri. */
  existingTimestamps: readonly number[]
  /** Düzenlenen durağın kendi saniyesi; kendisiyle çakışma sayılmaz. */
  currentTimestamp?: number | null
}

export type CheckpointIssue = {
  field: 'timestampSeconds'
  message: string
}

/**
 * Süresi bilinmeyen (0) video için üst sınır denetimi yapılmaz.
 * Bunny'de süre dışarıdan gelir ve kayıt anında 0 olabilir; bu durumda
 * durak eklemeyi tamamen engellemek editörü kilitlerdi.
 */
export function validateCheckpointTimestamp(
  input: CheckpointValidationInput,
): CheckpointIssue | null {
  const { timestampSeconds, durationSeconds, existingTimestamps } = input

  if (!Number.isInteger(timestampSeconds)) {
    return { field: 'timestampSeconds', message: 'Zaman tam saniye olmalıdır.' }
  }
  if (timestampSeconds < 0) {
    return { field: 'timestampSeconds', message: 'Zaman negatif olamaz.' }
  }
  if (durationSeconds > 0 && timestampSeconds >= durationSeconds) {
    return {
      field: 'timestampSeconds',
      message: `Zaman videonun süresinden (${formatTimestamp(durationSeconds)}) küçük olmalıdır.`,
    }
  }

  const current = input.currentTimestamp ?? null
  const clash = existingTimestamps.some(
    (existing) => existing === timestampSeconds && existing !== current,
  )
  if (clash) {
    return {
      field: 'timestampSeconds',
      message: `Bu videoda ${formatTimestamp(timestampSeconds)} saniyesinde zaten bir durak var.`,
    }
  }

  return null
}

/** Saniyeyi `s:ss` / `sa:dd:ss` biçimine çevirir. Negatif değer 0 sayılır. */
export function formatTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/**
 * Durağın zaman çubuğundaki yüzde konumu.
 * Süre bilinmiyorsa 0 döner — çubuk boş görünür, bölme hatası olmaz.
 */
export function timelinePercent(timestampSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0
  const ratio = timestampSeconds / durationSeconds
  return Math.min(100, Math.max(0, ratio * 100))
}

/**
 * `1:05` / `65` / `1:02:03` biçimlerini saniyeye çevirir.
 * Çözümlenemeyen girdi `null` döner (çağıran Türkçe hatayı üretir).
 */
export function parseTimestamp(raw: string): number | null {
  const value = raw.trim()
  if (value === '') return null

  const parts = value.split(':')
  if (parts.length > 3) return null

  let total = 0
  for (const part of parts) {
    if (!/^\d+$/.test(part.trim())) return null
    total = total * 60 + Number(part.trim())
  }
  return total
}
