import { describe, expect, it } from 'vitest'

import { AppError } from '@/lib/errors'
import {
  buildBunnySignedUrl,
  buildBunnyToken,
  bunnyPlaylistPath,
  resolveBunnyConfig,
} from './bunny-token'

/**
 * Sabit örnek: token_key = 'test-token-key', path = '/abc-123/playlist.m3u8',
 * expiry = 1767225600. Beklenen değer sha256'nın URL güvenli base64'üdür ve
 * bağımsız olarak (node -e ile) üretilmiştir. Bu değer değişirse imza şeması
 * değişmiş demektir — Bunny tarafındaki her oynatma kırılır.
 */
const FIXTURE = {
  tokenKey: 'test-token-key',
  path: '/abc-123/playlist.m3u8',
  expiresAtSeconds: 1767225600,
  token: 'H5CoQUAA-zoaOJTz2eNrfXI6B_OAMT5cGlhpP4Uww2M',
}

describe('buildBunnyToken', () => {
  it('bilinen örnekle birebir aynı token üretir', () => {
    expect(
      buildBunnyToken({
        tokenKey: FIXTURE.tokenKey,
        path: FIXTURE.path,
        expiresAtSeconds: FIXTURE.expiresAtSeconds,
      }),
    ).toBe(FIXTURE.token)
  })

  it('URL güvenli alfabede kalır ve dolgu taşımaz', () => {
    const token = buildBunnyToken({ tokenKey: 'k', path: '/p', expiresAtSeconds: 1 })
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('süre değişince token değişir', () => {
    const a = buildBunnyToken({ ...FIXTURE, expiresAtSeconds: 1 })
    const b = buildBunnyToken({ ...FIXTURE, expiresAtSeconds: 2 })
    expect(a).not.toBe(b)
  })
})

describe('bunnyPlaylistPath', () => {
  it('baştaki eğik çizgiyle HLS yolunu verir', () => {
    expect(bunnyPlaylistPath('abc-123')).toBe('/abc-123/playlist.m3u8')
  })
})

describe('buildBunnySignedUrl', () => {
  it('token ve son kullanma parametrelerini ekler', () => {
    expect(
      buildBunnySignedUrl({
        config: { pullZone: 'zihin.b-cdn.net', tokenKey: FIXTURE.tokenKey, libraryId: null },
        path: FIXTURE.path,
        expiresAtSeconds: FIXTURE.expiresAtSeconds,
      }),
    ).toBe(
      `https://zihin.b-cdn.net${FIXTURE.path}?token=${FIXTURE.token}&expires=${FIXTURE.expiresAtSeconds}`,
    )
  })
})

describe('resolveBunnyConfig', () => {
  it('eksiksiz ortamda yapılandırmayı döner', () => {
    expect(
      resolveBunnyConfig({
        BUNNY_PULL_ZONE: 'zihin.b-cdn.net',
        BUNNY_TOKEN_KEY: 'k',
        BUNNY_LIBRARY_ID: '42',
      }),
    ).toEqual({ pullZone: 'zihin.b-cdn.net', tokenKey: 'k', libraryId: '42' })
  })

  it('eksik değişkenleri Türkçe hata mesajında sayar', () => {
    try {
      resolveBunnyConfig({})
      throw new Error('hata bekleniyordu')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const message = (error as AppError).message
      expect(message).toContain('BUNNY_PULL_ZONE')
      expect(message).toContain('BUNNY_TOKEN_KEY')
      expect(message).toContain('Video sağlayıcısı')
    }
  })

  it('tek eksik değişkende de hata verir', () => {
    expect(() => resolveBunnyConfig({ BUNNY_PULL_ZONE: 'z' })).toThrow(AppError)
  })
})
