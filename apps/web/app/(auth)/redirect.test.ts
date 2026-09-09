import { describe, expect, it } from 'vitest'
import { isSafeRedirect, safeRedirectOr } from './redirect'

describe('isSafeRedirect', () => {
  it('uygulama içi yolları kabul eder', () => {
    expect(isSafeRedirect('/dashboard')).toBe(true)
    expect(isSafeRedirect('/dersler/matematik?konu=turev')).toBe(true)
    expect(isSafeRedirect('/')).toBe(true)
    // Yüzde kodlu boşluk meşru bir yol parçasıdır.
    expect(isSafeRedirect('/dersler/ileri%20matematik')).toBe(true)
  })

  it('protokol-göreli ve mutlak URL"leri reddeder', () => {
    expect(isSafeRedirect('//evil.com')).toBe(false)
    expect(isSafeRedirect('///evil.com')).toBe(false)
    expect(isSafeRedirect('https://evil.com')).toBe(false)
    expect(isSafeRedirect('http://evil.com')).toBe(false)
    expect(isSafeRedirect('https:evil.com')).toBe(false)
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false)
    expect(isSafeRedirect('/\\evil.com')).toBe(false)
    expect(isSafeRedirect('/evil.com\\x')).toBe(false)
    expect(isSafeRedirect('/javascript:alert(1)')).toBe(false)
    expect(isSafeRedirect('/user:parola@evil.com')).toBe(false)
  })

  /**
   * Ham değer masum görünür ama Location başlığına yazılmadan önce bir
   * proxy/CDN katmanı normalleştirirse yeniden protokol-göreli URL olur.
   */
  it('yüzde kodlanmış eğik çizgi ve ters eğik çizgiyi reddeder', () => {
    expect(isSafeRedirect('/%2f%2fevil.com')).toBe(false)
    expect(isSafeRedirect('/%2F%2Fevil.com')).toBe(false)
    expect(isSafeRedirect('/%5cevil.com')).toBe(false)
    expect(isSafeRedirect('/%5C%5Cevil.com')).toBe(false)
    // Çift kodlama da elenir.
    expect(isSafeRedirect('/%252f%252fevil.com')).toBe(false)
  })

  it('boş ve tanımsız değerleri reddeder', () => {
    expect(isSafeRedirect('')).toBe(false)
    expect(isSafeRedirect(null)).toBe(false)
    expect(isSafeRedirect(undefined)).toBe(false)
    expect(isSafeRedirect('dashboard')).toBe(false)
  })

  it('denetim karakteri ve CRLF içeren değerleri reddeder', () => {
    expect(isSafeRedirect('/\nhttps://evil.com')).toBe(false)
    expect(isSafeRedirect('/\r\nSet-Cookie: a=b')).toBe(false)
    expect(isSafeRedirect('/%0d%0aSet-Cookie:%20a=b')).toBe(false)
    expect(isSafeRedirect('/%0a//evil.com')).toBe(false)
    expect(isSafeRedirect('/\u0000')).toBe(false)
    expect(isSafeRedirect('/\u2028//evil.com')).toBe(false)
    expect(isSafeRedirect('/ ')).toBe(false)
    expect(isSafeRedirect('/\t/evil.com')).toBe(false)
  })

  it('bozuk yüzde dizisini reddeder', () => {
    expect(isSafeRedirect('/%')).toBe(false)
    expect(isSafeRedirect('/%zz')).toBe(false)
  })
})

describe('safeRedirectOr', () => {
  it('güvenli yolu geçirir, güvensizde varsayılana düşer', () => {
    expect(safeRedirectOr('/dashboard', '/veli')).toBe('/dashboard')
    expect(safeRedirectOr('//evil.com', '/veli')).toBe('/veli')
    expect(safeRedirectOr('/%2f%2fevil.com', '/veli')).toBe('/veli')
    expect(safeRedirectOr(null, '/veli')).toBe('/veli')
  })
})
