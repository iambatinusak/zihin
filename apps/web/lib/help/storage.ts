/**
 * `help-uploads` kovasındaki nesne anahtarını üretir.
 *
 * DEĞİŞMEZ KURAL: anahtar `<user_id>/<dosya_adı>` ile başlamak zorundadır.
 * `supabase/migrations/0012_storage.sql` içindeki `help_uploads_insert_own`
 * politikası tam olarak bunu şart koşuyor:
 *   (storage.foldername(name))[1] = auth.uid()::text
 * Başka bir düzen yüklemeyi RLS'e takar. Bu yüzden anahtar elle
 * birleştirilmez, hep buradan üretilir.
 */

export const HELP_UPLOADS_BUCKET = 'help-uploads'

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

/** MIME türünden dosya uzantısı; bilinmeyen tür `jpg` sayılır (küçültme JPEG üretir). */
export function extensionForType(type: string | null | undefined): string {
  return EXTENSION_BY_TYPE[(type ?? '').toLowerCase()] ?? 'jpg'
}

export type HelpUploadKeyOptions = {
  /** Dosya adının benzersiz gövdesi; verilmezse çağıran üretmelidir. */
  unique: string
  /** Yüklenen dosyanın MIME türü. */
  type?: string | null
}

/**
 * `<user_id>/<unique>.<ext>` üretir.
 *
 * Kullanıcının verdiği özgün dosya adı KULLANILMAZ: içinde `/`, `..` ya da
 * Türkçe karakter olabilir; nesne anahtarında bunlarla uğraşmak yerine ad
 * tamamen sunucu/istemci tarafından üretilen bir kimliktir.
 */
export function buildHelpUploadKey(userId: string, options: HelpUploadKeyOptions): string {
  const owner = userId.trim()
  if (owner === '') throw new Error('help-uploads anahtarı için kullanıcı kimliği gerekli.')

  const unique = sanitizeSegment(options.unique)
  if (unique === '') throw new Error('help-uploads anahtarı için benzersiz bir ad gerekli.')

  return `${owner}/${unique}.${extensionForType(options.type)}`
}

/**
 * Bir nesne anahtarının gerçekten bu kullanıcıya ait olup olmadığı.
 * Sunucu, istemciden gelen anahtarı yazmadan önce bunu doğrular — aksi hâlde
 * öğrenci başka birinin klasörünü işaret eden bir yol kaydettirebilirdi.
 */
export function isOwnHelpUploadKey(key: string, userId: string): boolean {
  const parts = key.split('/')
  if (parts.length !== 2) return false
  const [folder, file] = parts
  if (folder !== userId.trim() || !file) return false
  // `..` ya da boş ad kabul edilmez.
  return file !== '.' && file !== '..'
}

/** Anahtar parçasından güvenli olmayan her şeyi atar. */
function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64)
}
