import { describe, expect, it } from 'vitest'
import {
  buildHelpUploadKey,
  extensionForType,
  HELP_UPLOADS_BUCKET,
  isOwnHelpUploadKey,
} from './storage'

const USER = '11111111-2222-3333-4444-555555555555'

describe('buildHelpUploadKey', () => {
  it('anahtar kullanıcı kimliğiyle başlar (0012 RLS politikası bunu şart koşar)', () => {
    const key = buildHelpUploadKey(USER, { unique: 'abc123', type: 'image/jpeg' })
    expect(key).toBe(`${USER}/abc123.jpg`)
    expect(key.split('/')[0]).toBe(USER)
  })

  it('MIME türüne göre uzantı seçer, bilinmeyende jpg kullanır', () => {
    expect(buildHelpUploadKey(USER, { unique: 'a', type: 'image/png' })).toBe(`${USER}/a.png`)
    expect(buildHelpUploadKey(USER, { unique: 'a', type: 'image/webp' })).toBe(`${USER}/a.webp`)
    expect(buildHelpUploadKey(USER, { unique: 'a', type: 'application/pdf' })).toBe(`${USER}/a.jpg`)
    expect(buildHelpUploadKey(USER, { unique: 'a' })).toBe(`${USER}/a.jpg`)
  })

  it('benzersiz addaki tehlikeli karakterleri atar', () => {
    expect(buildHelpUploadKey(USER, { unique: '../../gizli DOSYA' })).toBe(`${USER}/gizlidosya.jpg`)
  })

  it('kullanıcı kimliği ya da ad boşsa hata verir', () => {
    expect(() => buildHelpUploadKey('  ', { unique: 'a' })).toThrow()
    expect(() => buildHelpUploadKey(USER, { unique: '///' })).toThrow()
  })

  it('kova adı sabittir', () => {
    expect(HELP_UPLOADS_BUCKET).toBe('help-uploads')
  })
})

describe('isOwnHelpUploadKey', () => {
  it('kendi klasörünü kabul eder', () => {
    expect(isOwnHelpUploadKey(`${USER}/abc.jpg`, USER)).toBe(true)
  })

  it('başkasının klasörünü, derin yolu ve bozuk yolu reddeder', () => {
    expect(isOwnHelpUploadKey('99999999-0000-0000-0000-000000000000/a.jpg', USER)).toBe(false)
    expect(isOwnHelpUploadKey(`${USER}/alt/a.jpg`, USER)).toBe(false)
    expect(isOwnHelpUploadKey('a.jpg', USER)).toBe(false)
    expect(isOwnHelpUploadKey(`${USER}/..`, USER)).toBe(false)
    expect(isOwnHelpUploadKey('', USER)).toBe(false)
  })
})

describe('extensionForType', () => {
  it('tanınan türler', () => {
    expect(extensionForType('image/heic')).toBe('heic')
    expect(extensionForType(null)).toBe('jpg')
  })
})
