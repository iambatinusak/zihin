import { createHash } from 'node:crypto'

import { AppError } from '@/lib/errors'

/**
 * Bunny token doğrulamalı bağlantı üretimi — saf mantık.
 *
 * Ayrı dosyada durmasının sebebi test edilebilirlik: imza üretimi bir
 * kriptografik sözleşmedir ve tek bir karakterlik sapma tüm oynatmaları
 * kırar; Bunny hesabı olmadan yalnızca sabit bir örnekle doğrulanabilir.
 */

export type BunnyConfig = {
  pullZone: string
  tokenKey: string
  libraryId: string | null
}

/**
 * Bunny yapılandırması. Eksik değişkenler ancak sağlayıcı gerçekten
 * çağrıldığında hata vermelidir — import anında değil; aksi halde Bunny
 * kullanmayan bir kurulumda uygulama hiç açılmaz.
 */
export function resolveBunnyConfig(env: {
  BUNNY_PULL_ZONE?: string | undefined
  BUNNY_TOKEN_KEY?: string | undefined
  BUNNY_LIBRARY_ID?: string | undefined
}): BunnyConfig {
  const missing: string[] = []
  if (!env.BUNNY_PULL_ZONE) missing.push('BUNNY_PULL_ZONE')
  if (!env.BUNNY_TOKEN_KEY) missing.push('BUNNY_TOKEN_KEY')

  if (missing.length > 0 || !env.BUNNY_PULL_ZONE || !env.BUNNY_TOKEN_KEY) {
    throw new AppError(
      'internal',
      `Video sağlayıcısı "bunny" seçili ama yapılandırma eksik: ${missing.join(', ')}. ` +
        'Ortam değişkenlerini tanımlayın ya da VIDEO_PROVIDER değerini "supabase" yapın.',
    )
  }

  return {
    pullZone: env.BUNNY_PULL_ZONE,
    tokenKey: env.BUNNY_TOKEN_KEY,
    libraryId: env.BUNNY_LIBRARY_ID ?? null,
  }
}

/** Base64'ü URL güvenli biçime çevirir (Bunny'nin beklediği kodlama). */
function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Bunny token'ı: sha256(token_key + path + expiry) değerinin URL güvenli
 * base64 karşılığı. `path` her zaman baştaki eğik çizgiyle verilir.
 */
export function buildBunnyToken(input: {
  tokenKey: string
  path: string
  expiresAtSeconds: number
}): string {
  const hash = createHash('sha256')
    .update(`${input.tokenKey}${input.path}${input.expiresAtSeconds}`)
    .digest()
  return base64Url(hash)
}

/** Bunny Stream HLS oynatma listesinin yolu. */
export function bunnyPlaylistPath(providerVideoId: string): string {
  return `/${providerVideoId}/playlist.m3u8`
}

/** Token ve son kullanma bilgisini taşıyan tam oynatma bağlantısı. */
export function buildBunnySignedUrl(input: {
  config: BunnyConfig
  path: string
  expiresAtSeconds: number
}): string {
  const token = buildBunnyToken({
    tokenKey: input.config.tokenKey,
    path: input.path,
    expiresAtSeconds: input.expiresAtSeconds,
  })
  return `https://${input.config.pullZone}${input.path}?token=${token}&expires=${input.expiresAtSeconds}`
}
