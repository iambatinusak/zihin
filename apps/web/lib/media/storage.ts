/**
 * `videos` kovasındaki nesne anahtarı.
 *
 * `0012_storage.sql` bu kovada klasör deseni ŞART KOŞMAZ (politika yalnızca
 * `public.is_editor()` arar), ama düzen yine de tek bir yerden üretilir:
 * anahtar konuya göre kümelenirse bir konunun videolarını depoda bulmak,
 * taşımak ve silmek elle iz sürmeden mümkün olur.
 *
 * Kullanıcının verdiği dosya adı KULLANILMAZ: içinde `/`, `..` ya da Türkçe
 * karakter olabilir. Ad tamamen üretilir, yalnızca uzantı korunur.
 */

export const VIDEOS_BUCKET = 'videos'

const EXTENSION_BY_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
}

/** Kabul edilen video türleri; başka bir tür yüklenmez. */
export const ACCEPTED_VIDEO_TYPES = Object.keys(EXTENSION_BY_TYPE)

/** Tek dosya üst sınırı: 2 GB. Ders videosu bunu aşıyorsa önce sıkıştırılmalı. */
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024

export function extensionForVideoType(type: string | null | undefined): string | null {
  return EXTENSION_BY_TYPE[(type ?? '').toLowerCase()] ?? null
}

export function buildVideoStorageKey(topicId: string, unique: string, type: string): string {
  const folder = sanitize(topicId)
  if (folder === '') throw new Error('Video anahtarı için konu kimliği gerekli.')

  const name = sanitize(unique)
  if (name === '') throw new Error('Video anahtarı için benzersiz bir ad gerekli.')

  const extension = extensionForVideoType(type)
  if (!extension) throw new Error('Desteklenmeyen video türü.')

  return `${folder}/${name}.${extension}`
}

/**
 * Bir anahtarın bu kovaya yazılabilecek biçimde olup olmadığı.
 * Sunucu, istemciden gelen `storage_path` değerini satıra yazmadan önce
 * bunu doğrular — aksi hâlde `../` içeren bir yol kaydedilebilirdi.
 */
export function isValidVideoStorageKey(key: string): boolean {
  const parts = key.split('/')
  if (parts.length !== 2) return false
  const [folder, file] = parts
  if (!folder || !file) return false
  if (folder === '.' || folder === '..' || file === '.' || file === '..') return false
  return /^[a-z0-9-]+$/.test(folder) && /^[a-z0-9-]+\.[a-z0-9]+$/.test(file)
}

function sanitize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64)
}
