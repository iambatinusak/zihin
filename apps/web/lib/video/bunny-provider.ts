import 'server-only'

import { serverEnv } from '@/lib/env'
import { AppError } from '@/lib/errors'
import {
  SIGNED_URL_TTL_SECONDS,
  type SignedVideo,
  type VideoProvider,
  type VideoRef,
} from './provider'
import { buildBunnySignedUrl, bunnyPlaylistPath, resolveBunnyConfig } from './bunny-token'

/**
 * Bunny Stream sağlayıcısı. Yapılandırma yalnızca çağrı anında okunur;
 * eksikse Türkçe bir kurulum hatası fırlatılır (import anında değil).
 */
export function createBunnyVideoProvider(): VideoProvider {
  return {
    async getSignedUrl(video: VideoRef): Promise<SignedVideo> {
      if (!video.providerVideoId) {
        throw new AppError('not_found', 'Bu videonun sağlayıcı kimliği tanımlı değil.')
      }

      const config = resolveBunnyConfig(serverEnv())
      const expiresAtSeconds = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS

      return {
        url: buildBunnySignedUrl({
          config,
          path: bunnyPlaylistPath(video.providerVideoId),
          expiresAtSeconds,
        }),
        expiresAt: new Date(expiresAtSeconds * 1000),
        provider: 'bunny',
      }
    },

    getThumbnailUrl(video: VideoRef): string | null {
      if (video.thumbnailUrl) return video.thumbnailUrl
      if (!video.providerVideoId) return null

      // Küçük resim gizli değildir; token gerektirmez.
      const config = resolveBunnyConfig(serverEnv())
      return `https://${config.pullZone}/${video.providerVideoId}/thumbnail.jpg`
    },
  }
}
