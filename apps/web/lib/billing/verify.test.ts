import { describe, expect, it } from 'vitest'
import { decideWebhookOutcome, type PaymentRecord } from './verify'
import type { PaymentVerification } from './provider'

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'pay-1',
    userId: 'user-1',
    packageId: 'pkg-1',
    providerRef: 'conv-1',
    amount: 2490,
    currency: 'TRY',
    status: 'pending',
    ...overrides,
  }
}

function verification(overrides: Partial<PaymentVerification> = {}): PaymentVerification {
  return {
    provider: 'iyzico',
    conversationId: 'conv-1',
    providerPaymentId: 'iyz-99',
    status: 'success',
    paidPrice: 2490,
    currency: 'TRY',
    failureMessage: null,
    raw: {},
    ...overrides,
  }
}

describe('decideWebhookOutcome — doğrulanmış tahsilat', () => {
  it('durum, tutar ve para birimi uyuşuyorsa abonelik açılır', () => {
    expect(decideWebhookOutcome(payment(), verification())).toEqual({ kind: 'grant' })
  })

  it('kuruş farkı kayan nokta toleransı içindeyse kabul edilir', () => {
    const decision = decideWebhookOutcome(
      payment({ amount: 1990.5 }),
      verification({ paidPrice: 1990.5000001 }),
    )
    expect(decision).toEqual({ kind: 'grant' })
  })
})

describe('decideWebhookOutcome — idempotensi', () => {
  it('zaten başarılı ödeme ikinci kez işlenmez', () => {
    // İki kez teslim edilen webhook, ikinci abonelik açmamalı.
    expect(decideWebhookOutcome(payment({ status: 'success' }), verification())).toEqual({
      kind: 'already_processed',
    })
  })

  it('iade edilmiş ödeme yeniden canlandırılmaz', () => {
    expect(decideWebhookOutcome(payment({ status: 'refunded' }), verification())).toEqual({
      kind: 'already_processed',
    })
  })

  it('başarısız ödeme yeniden değerlendirilebilir', () => {
    // Kullanıcı aynı oturumla tekrar deneyip başarılı olabilir.
    expect(decideWebhookOutcome(payment({ status: 'failed' }), verification())).toEqual({
      kind: 'grant',
    })
  })
})

describe('decideWebhookOutcome — uyuşmazlık abonelik açmaz', () => {
  it('düşük tutar tahsil edilmişse reddedilir', () => {
    // 4.490 TL'lik paketi 1 TL ile açma denemesi.
    const decision = decideWebhookOutcome(payment({ amount: 4490 }), verification({ paidPrice: 1 }))
    expect(decision.kind).toBe('mismatch')
  })

  it('fazla tutar da uyuşmazlıktır', () => {
    expect(decideWebhookOutcome(payment(), verification({ paidPrice: 9999 })).kind).toBe('mismatch')
  })

  it('para birimi farklıysa reddedilir', () => {
    // 2490 USD ≠ 2490 TRY.
    expect(decideWebhookOutcome(payment(), verification({ currency: 'USD' })).kind).toBe('mismatch')
  })

  it('para birimi büyük/küçük harf farkı uyuşmazlık değildir', () => {
    expect(decideWebhookOutcome(payment(), verification({ currency: 'try' })).kind).toBe('grant')
  })

  it('tutar bildirilmemişse abonelik açılmaz', () => {
    expect(decideWebhookOutcome(payment(), verification({ paidPrice: null })).kind).toBe('mismatch')
  })

  it('sağlayıcı başarısız diyorsa ödeme başarısızdır', () => {
    const decision = decideWebhookOutcome(
      payment(),
      verification({ status: 'failed', failureMessage: 'Yetersiz bakiye' }),
    )
    expect(decision).toEqual({ kind: 'failed', reason: 'Yetersiz bakiye' })
  })

  it('başarısızlık nedeni bildirilmemişse genel mesaj kullanılır', () => {
    const decision = decideWebhookOutcome(payment(), verification({ status: 'failed' }))
    expect(decision.kind).toBe('failed')
  })
})
