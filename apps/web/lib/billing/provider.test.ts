import { describe, expect, it, vi } from 'vitest'

// `server-only` yalnızca RSC bağlamında çözülür; sahte sağlayıcı onu içe
// aktardığı için testte etkisiz hâle getirilir.
vi.mock('server-only', () => ({}))
import { selectBillingProviderName } from './provider'
import { decodeMockToken, encodeMockToken } from './mock-provider'

describe('selectBillingProviderName', () => {
  it('anahtar doluysa gerçek sağlayıcıyı seçer', () => {
    expect(selectBillingProviderName('sandbox-abc123')).toBe('iyzico')
  })

  it('anahtar yoksa sahte sağlayıcıya düşer', () => {
    expect(selectBillingProviderName(undefined)).toBe('mock')
    expect(selectBillingProviderName(null)).toBe('mock')
    expect(selectBillingProviderName('')).toBe('mock')
  })

  it('yalnızca boşluktan oluşan anahtar tanımlı sayılmaz', () => {
    // .env dosyasında `IYZICO_API_KEY= ` yazılması gerçek sağlayıcıyı
    // devreye sokmamalı; kimlik bilgisi yokken istek atmaya çalışırdı.
    expect(selectBillingProviderName('   ')).toBe('mock')
  })
})

describe('sahte sağlayıcı token biçimi', () => {
  it('tutarı gidip gelirken korur', () => {
    const token = encodeMockToken('11111111-2222-3333-4444-555555555555', 2490)
    expect(decodeMockToken(token)).toEqual({
      conversationId: '11111111-2222-3333-4444-555555555555',
      amountTry: 2490,
    })
  })

  it('bozuk token çözülmez', () => {
    expect(decodeMockToken('mock_only-two-parts')).toBeNull()
    expect(decodeMockToken('gercek_abc_10.00')).toBeNull()
    expect(decodeMockToken('mock_abc_bedava')).toBeNull()
  })
})
