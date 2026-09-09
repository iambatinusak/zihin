import { serverEnv } from '@/lib/env'
import { createSupabaseVideoProvider } from './supabase-provider'
import { createBunnyVideoProvider } from './bunny-provider'
import type { VideoProvider, VideoProviderName } from './provider'

export type { SignedVideo, VideoProvider, VideoProviderName, VideoRef } from './provider'
export { SIGNED_URL_TTL_SECONDS } from './provider'

const FACTORIES: Record<VideoProviderName, () => VideoProvider> = {
  supabase: createSupabaseVideoProvider,
  bunny: createBunnyVideoProvider,
}

/**
 * Yürürlükteki sağlayıcıyı döner. Seçim ortam değişkeninden gelir; sağlayıcıya
 * özgü yapılandırma hataları burada değil, ilk imzalama çağrısında yüzeye
 * çıkar — yanlış yapılandırılmış bir Bunny kurulumu uygulamanın açılışını
 * engellemesin diye.
 */
export function getVideoProvider(name?: VideoProviderName): VideoProvider {
  const selected = name ?? serverEnv().VIDEO_PROVIDER
  return FACTORIES[selected]()
}
