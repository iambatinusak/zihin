import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { AppError } from '@/lib/errors'
import {
  SIGNED_URL_TTL_SECONDS,
  type SignedVideo,
  type VideoProvider,
  type VideoRef,
} from './provider'

/**
 * Supabase Storage sağlayıcısı.
 *
 * Bucket gizlidir; oynatma bağlantısı service-role istemcisiyle imzalanır.
 * Ödeme duvarı bu katmanda değil, imzalamayı çağıran action'da uygulanır —
 * buraya gelen her istek çoktan yetkilendirilmiş sayılır.
 */
export function createSupabaseVideoProvider(): VideoProvider {
  return {
    async getSignedUrl(video: VideoRef): Promise<SignedVideo> {
      if (!video.storagePath) {
        throw new AppError('not_found', 'Bu videonun dosya yolu tanımlı değil.')
      }

      const bucket = serverEnv().SUPABASE_VIDEO_BUCKET
      const admin = createSupabaseAdminClient()

      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(video.storagePath, SIGNED_URL_TTL_SECONDS)

      if (error || !data?.signedUrl) {
        throw new AppError('internal', 'Video bağlantısı oluşturulamadı.')
      }

      return {
        url: data.signedUrl,
        expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000),
        provider: 'supabase',
      }
    },

    getThumbnailUrl(video: VideoRef): string | null {
      return video.thumbnailUrl
    },
  }
}
