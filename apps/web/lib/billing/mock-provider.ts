import 'server-only'

import type { Json } from '@zihin/db/types'
import type {
  BillingProvider,
  CheckoutRequest,
  CheckoutSession,
  PaymentVerification,
} from './provider'
import { BILLING_CURRENCY } from './provider'

/**
 * Sahte ödeme sağlayıcısı — `IYZICO_API_KEY` boşken devreye girer.
 *
 * VAR OLMA SEBEBİ: kimlik bilgisi olmadan da ödeme akışının uçtan uca
 * geliştirilebilmesi. Gerçek bir tahsilat YAPMAZ.
 *
 * ── SESSİZ OLMAMA SÖZÜ ─────────────────────────────────────────────────────
 * Bu sağlayıcı `isMock: true` bildirir; arayüz bunu Türkçe bir uyarı bandına
 * çevirir (components/billing/mock-payment-notice.tsx) ve `payments.provider`
 * kolonu `'mock'` yazılır. Sahte bir ödeme hiçbir yerde gerçek gibi
 * görünmez — ne kullanıcıya, ne veritabanında, ne de raporda.
 *
 * ── TOKEN NEDEN TUTARI TAŞIYOR ─────────────────────────────────────────────
 * Sağlayıcı nesnesi her çağrıda yeniden kuruluyor (bkz. index.ts), bu yüzden
 * bellekte oturum tutulamaz. Tutar token'a yazılır. Bu bir açık DEĞİLDİR:
 * token'ı uyduran biri tutarı da uydurabilir, ama webhook onu `payments`
 * satırındaki sunucu tarafı fiyatla karşılaştırır (lib/billing/verify.ts) ve
 * uyuşmayan her şey `mismatch` olur. Sahte sağlayıcı yalnızca "ödeme oldu"
 * diyebilir, "ne kadar ödendiği"ne karar veremez.
 */

/** Sahte ödeme sayfası: kullanıcı burada "öde" düğmesine basar. */
const MOCK_PAY_PATH = '/odeme/test'

const TOKEN_PREFIX = 'mock'

export function createMockBillingProvider(): BillingProvider {
  return {
    name: 'mock',
    isMock: true,

    async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
      const token = encodeMockToken(request.conversationId, request.amountTry)
      const url = new URL(MOCK_PAY_PATH, request.callbackUrl)
      url.searchParams.set('token', token)

      return {
        provider: 'mock',
        token,
        paymentPageUrl: url.toString(),
        raw: { mock: true, amountTry: request.amountTry, packageId: request.packageId } as Json,
      }
    },

    async retrievePayment(token: string): Promise<PaymentVerification> {
      const decoded = decodeMockToken(token)

      return {
        provider: 'mock',
        conversationId: decoded?.conversationId ?? null,
        providerPaymentId: token,
        // Çözülemeyen token bir "başarılı ödeme" sayılmaz.
        status: decoded ? 'success' : 'failed',
        paidPrice: decoded?.amountTry ?? null,
        currency: BILLING_CURRENCY,
        failureMessage: decoded ? null : 'Test ödemesi anahtarı çözülemedi.',
        raw: { mock: true, token, resolved: decoded !== null } as Json,
      }
    },
  }
}

export function encodeMockToken(conversationId: string, amountTry: number): string {
  return `${TOKEN_PREFIX}_${conversationId}_${amountTry.toFixed(2)}`
}

export function decodeMockToken(
  token: string,
): { conversationId: string; amountTry: number } | null {
  const parts = token.split('_')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null

  const conversationId = parts[1] ?? ''
  const amountTry = Number.parseFloat(parts[2] ?? '')
  if (conversationId === '' || !Number.isFinite(amountTry)) return null

  return { conversationId, amountTry }
}
