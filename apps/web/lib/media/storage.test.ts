import { describe, expect, it } from 'vitest'
import { buildVideoStorageKey, extensionForVideoType, isValidVideoStorageKey } from './storage'

describe('extensionForVideoType', () => {
  it('bilinen türleri çevirir', () => {
    expect(extensionForVideoType('video/mp4')).toBe('mp4')
    expect(extensionForVideoType('VIDEO/WEBM')).toBe('webm')
  })

  it('bilinmeyen türde null döner', () => {
    expect(extensionForVideoType('application/pdf')).toBeNull()
    expect(extensionForVideoType(null)).toBeNull()
  })
})

describe('buildVideoStorageKey', () => {
  it('konu klasörü altında üretilmiş ad kullanır', () => {
    const key = buildVideoStorageKey('AB12-cd', 'Ders 1 Videosu', 'video/mp4')
    expect(key).toBe('ab12-cd/ders1videosu.mp4')
  })

  it('desteklenmeyen türde hata fırlatır', () => {
    expect(() => buildVideoStorageKey('abc', 'ad', 'text/plain')).toThrow()
  })

  it('boş konu kimliğinde hata fırlatır', () => {
    expect(() => buildVideoStorageKey('  ', 'ad', 'video/mp4')).toThrow()
  })
})

describe('isValidVideoStorageKey', () => {
  it('üretilen anahtarı kabul eder', () => {
    expect(isValidVideoStorageKey('abc/video-1.mp4')).toBe(true)
  })

  it('dizin kaçışını reddeder', () => {
    expect(isValidVideoStorageKey('../gizli.mp4')).toBe(false)
    expect(isValidVideoStorageKey('a/b/c.mp4')).toBe(false)
    expect(isValidVideoStorageKey('video.mp4')).toBe(false)
  })
})
