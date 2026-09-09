/**
 * `question-images` kovasındaki nesne anahtarı — SAF.
 *
 * `lib/help/storage.ts` ile aynı düzen kullanılır: `<user_id>/<benzersiz>.<uzantı>`.
 * 0012_storage.sql'deki politika bu kovada yalnızca `is_editor()` şartı koyuyor,
 * yani klasör adı RLS için ZORUNLU DEĞİL. Yine de kullanıcı klasörü tutulur:
 * bir görselin kimin yüklediği anahtardan okunabilir, temizlik ve kötüye
 * kullanım incelemesi bunsuz yapılamaz.
 *
 * Kullanıcının verdiği dosya adı KULLANILMAZ (`/`, `..` ve Türkçe karakter
 * içerebilir); ad tamamen üretilir.
 */

export const QUESTION_IMAGES_BUCKET = 'question-images'

/** Soru görseli için en büyük dosya: 5 MB. */
export const MAX_QUESTION_IMAGE_BYTES = 5 * 1024 * 1024

export const ALLOWED_QUESTION_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type AllowedQuestionImageType = (typeof ALLOWED_QUESTION_IMAGE_TYPES)[number]

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function isAllowedQuestionImageType(type: string | null | undefined): boolean {
  return ALLOWED_QUESTION_IMAGE_TYPES.includes(
    (type ?? '').toLowerCase() as AllowedQuestionImageType,
  )
}

export function isAllowedQuestionImageSize(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= MAX_QUESTION_IMAGE_BYTES
}

export function questionImageExtension(type: string | null | undefined): string {
  return EXTENSION_BY_TYPE[(type ?? '').toLowerCase()] ?? 'jpg'
}

/** `<user_id>/<benzersiz>.<uzantı>` üretir. */
export function buildQuestionImageKey(
  userId: string,
  options: { unique: string; type?: string | null },
): string {
  const owner = userId.trim()
  if (owner === '') throw new Error('question-images anahtarı için kullanıcı kimliği gerekli.')

  const unique = sanitizeSegment(options.unique)
  if (unique === '') throw new Error('question-images anahtarı için benzersiz bir ad gerekli.')

  return `${owner}/${unique}.${questionImageExtension(options.type)}`
}

/**
 * Anahtarın gerçekten bu kullanıcının klasöründe ve tek seviyeli olduğu.
 * Sunucu, istemciden gelen anahtarı yazmadan önce bunu doğrular.
 */
export function isOwnQuestionImageKey(key: string, userId: string): boolean {
  const parts = key.split('/')
  if (parts.length !== 2) return false
  const [folder, file] = parts
  if (folder !== userId.trim() || !file) return false
  return file !== '.' && file !== '..'
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64)
}
