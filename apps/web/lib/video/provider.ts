/**
 * Video sağlayıcı sözleşmesi (spec §15).
 *
 * MVP'de videolar Supabase Storage'ta duruyor; ölçek büyüdüğünde Bunny Stream'e
 * geçilecek. Oynatıcı ve action katmanı hangi sağlayıcının kullanıldığını
 * bilmemeli, bu yüzden imzalar arada bir soyutlamayla ayrılır.
 */

export type VideoProviderName = 'supabase' | 'bunny'

/** İmzalanmış oynatma bağlantısı. `expiresAt` istemcinin yenileme kararı içindir. */
export type SignedVideo = {
  url: string
  expiresAt: Date
  provider: VideoProviderName
}

/** İmzalama için gereken en az bilgi — `videos` satırının kopyası değildir. */
export type VideoRef = {
  id: string
  provider: VideoProviderName
  /** Supabase Storage yolu (bucket'a göreli). */
  storagePath: string | null
  /** Bunny tarafındaki video kimliği. */
  providerVideoId: string | null
  thumbnailUrl: string | null
}

export interface VideoProvider {
  getSignedUrl(video: VideoRef): Promise<SignedVideo>
  getThumbnailUrl(video: VideoRef): string | null
}

/** İmzalı bağlantı ömrü: 4 saat (spec §M3 BR). */
export const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60
