/**
 * Video kaynağı tutarlılık kuralı (spec §M15).
 *
 * Veritabanında şu kısıt var (`0004_content.sql`, `videos_source_check`):
 *   (provider = 'bunny'    and provider_video_id is not null)
 *   or (provider = 'supabase' and storage_path is not null)
 *
 * Kural burada bir kez daha, SAF olarak yazılır. Sebep: kısıt yalnızca
 * veritabanında kalırsa editör alan bazlı Türkçe bir hata yerine ham bir
 * Postgres hatası görür. Zod şeması bu fonksiyonu çağırır; böylece kuralın
 * uygulama tarafındaki tek kopyası da burasıdır ve test edilebilir.
 */

export type VideoProviderName = 'supabase' | 'bunny'

export type VideoSourceInput = {
  provider: VideoProviderName
  providerVideoId?: string | null
  storagePath?: string | null
}

/** Kuralı çiğneyen alan ve kullanıcıya gösterilecek Türkçe mesaj. */
export type VideoSourceIssue = {
  /** Zod `path` olarak kullanılır; hata doğru alanın altında görünür. */
  field: 'providerVideoId' | 'storagePath'
  message: string
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0
}

/**
 * Sağlayıcının zorunlu kıldığı alan dolu mu? Doluysa `null` döner.
 *
 * Boş string `null` sayılır: form alanları boş bırakıldığında `''` gönderir ve
 * `''` veritabanı kısıtını GEÇER (not null'dır) ama oynatılamayan bir video
 * üretir. Bu yüzden burada kısıttan daha sıkı davranılır.
 */
export function videoSourceIssue(input: VideoSourceInput): VideoSourceIssue | null {
  if (input.provider === 'bunny') {
    if (isBlank(input.providerVideoId)) {
      return {
        field: 'providerVideoId',
        message: 'Bunny sağlayıcısı için video kimliği zorunludur.',
      }
    }
    return null
  }

  if (isBlank(input.storagePath)) {
    return {
      field: 'storagePath',
      message: 'Supabase sağlayıcısı için bir video dosyası yüklemelisiniz.',
    }
  }
  return null
}

/**
 * Kaydedilecek satırın kaynak alanları.
 *
 * Kullanılmayan alan bilinçli olarak `null`a çekilir: sağlayıcı bunny'den
 * supabase'e çevrildiğinde eski `provider_video_id` satırda kalırsa hangi
 * kaynağın geçerli olduğu belirsizleşir.
 */
export function normaliseVideoSource(input: VideoSourceInput): {
  provider: VideoProviderName
  provider_video_id: string | null
  storage_path: string | null
} {
  const trimmed = (value: string | null | undefined): string | null => {
    if (isBlank(value)) return null
    return (value as string).trim()
  }

  return input.provider === 'bunny'
    ? {
        provider: 'bunny',
        provider_video_id: trimmed(input.providerVideoId),
        storage_path: null,
      }
    : {
        provider: 'supabase',
        provider_video_id: null,
        storage_path: trimmed(input.storagePath),
      }
}
