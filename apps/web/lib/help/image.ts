/**
 * Soru fotoğrafının kuralları (spec §M11).
 *
 * SAF ve ortak: aynı dosya hem tarayıcıda (yüklemeden önce küçültme ve erken
 * uyarı) hem sunucuda (gerçek denetim) kullanılır. İstemcideki küçültme bir
 * KOLAYLIKTIR, denetim değil — sunucu boyutu ve türü yeniden doğrular.
 */

/** Yüklenebilecek en büyük dosya: 5 MB (spec §M11). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Küçültme sonrası en uzun kenar. */
export const MAX_IMAGE_EDGE = 1600

/** JPEG sıkıştırma kalitesi. */
export const IMAGE_QUALITY = 0.85

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

export function isAllowedImageType(type: string | null | undefined): boolean {
  return ALLOWED_IMAGE_TYPES.includes((type ?? '').toLowerCase() as AllowedImageType)
}

export function isAllowedImageSize(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= MAX_IMAGE_BYTES
}

export type ImageDimensions = { width: number; height: number }

/**
 * Küçültme sonrası boyutlar.
 *
 * Kural: en uzun kenar `maxEdge`e indirilir, en-boy oranı korunur, görsel
 * ASLA büyütülmez (küçük bir fotoğrafı 1600'e şişirmek dosyayı büyütür,
 * çözünürlüğü artırmaz). Yuvarlama `round`; sonuç en az 1 px olur.
 */
export function resizeDimensions(
  source: ImageDimensions,
  maxEdge: number = MAX_IMAGE_EDGE,
): ImageDimensions {
  const width = Math.floor(source.width)
  const height = Math.floor(source.height)
  const edge = Math.floor(maxEdge)

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 }
  }
  if (!Number.isFinite(edge) || edge <= 0) return { width, height }

  const longest = Math.max(width, height)
  if (longest <= edge) return { width, height }

  const scale = edge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** İnsan okunur boyut etiketi ("4,2 MB") — hata mesajlarında kullanılır. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
