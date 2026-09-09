import 'server-only'

import { createHmac, randomBytes } from 'node:crypto'

import type { Json } from '@zihin/db/types'
import { serverEnv } from '@/lib/env'
import { providerPrice } from './money'
import type {
  BillingProvider,
  CheckoutRequest,
  CheckoutSession,
  PaymentVerification,
} from './provider'
import { BILLING_CURRENCY } from './provider'

/**
 * iyzico Checkout Form sağlayıcısı (sandbox).
 *
 * İki adım vardır:
 *   1. `initialize`  — ödeme oturumu açılır, kullanıcı `paymentPageUrl`e gider.
 *   2. `retrieve`    — dönüşte token ile ödemenin GERÇEK durumu çekilir.
 * Uygulama abonelik kararını YALNIZCA ikinci adımın yanıtından verir.
 *
 * ── NEDEN `iyzipay` PAKETİ YERİNE DOĞRUDAN HTTP ────────────────────────────
 * `iyzipay` npm paketi bu depoda kurulu değil (package.json'da yok) ve
 * bağımlılık eklemek kilit dosyasını paralel çalışan ajanlarla çakıştırıyor.
 * Kullanılan yüzey iki uç noktadan ibaret olduğu için imzalama burada elle
 * yapılıyor; sözleşme (`BillingProvider`) aynı kaldığından paket sonradan
 * eklenirse yalnızca bu dosya değişir.
 *
 * ── İMZA (IYZWSv2) ─────────────────────────────────────────────────────────
 * iyzico her isteği `HmacSHA256(secretKey, randomKey + uriPath + body)` ile
 * imzalar. Gizli anahtar ağa hiç çıkmaz; sunucudan başka yerde de okunmaz.
 */

const INITIALIZE_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom'
const RETRIEVE_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail'

/** Sağlayıcı yanıtı bu süre içinde gelmezse istek bırakılır. */
const REQUEST_TIMEOUT_MS = 20_000

type IyzicoConfig = {
  apiKey: string
  secretKey: string
  baseUrl: string
}

export function createIyzicoBillingProvider(config?: IyzicoConfig): BillingProvider {
  const resolved = config ?? readConfig()

  return {
    name: 'iyzico',
    isMock: false,

    async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
      const price = providerPrice(request.amountTry)

      const body = {
        locale: 'tr',
        conversationId: request.conversationId,
        price,
        paidPrice: price,
        currency: BILLING_CURRENCY,
        basketId: request.conversationId,
        paymentGroup: 'SUBSCRIPTION',
        callbackUrl: request.callbackUrl,
        enabledInstallments: [1],
        buyer: {
          id: request.buyer.id,
          name: request.buyer.name,
          surname: request.buyer.surname,
          email: request.buyer.email,
          identityNumber: '11111111111',
          registrationAddress: 'Bilgi verilmedi',
          ip: request.buyer.ip,
          city: 'Istanbul',
          country: 'Turkey',
        },
        // Dijital ürün: teslimat adresi yok ama iyzico alanı zorunlu tutuyor.
        billingAddress: {
          contactName: `${request.buyer.name} ${request.buyer.surname}`.trim(),
          city: 'Istanbul',
          country: 'Turkey',
          address: 'Bilgi verilmedi',
        },
        basketItems: [
          {
            id: request.packageId,
            name: request.packageName,
            category1: 'Egitim',
            itemType: 'VIRTUAL',
            price,
          },
        ],
      }

      const response = await call(resolved, INITIALIZE_PATH, body)

      const token = readString(response, 'token')
      const pageUrl = readString(response, 'paymentPageUrl')

      if (readString(response, 'status') !== 'success' || !token || !pageUrl) {
        throw new Error(
          `iyzico ödeme oturumu açılamadı: ${readString(response, 'errorMessage') ?? 'bilinmeyen hata'}`,
        )
      }

      return {
        provider: 'iyzico',
        token,
        paymentPageUrl: pageUrl,
        raw: response as Json,
      }
    },

    async retrievePayment(token: string): Promise<PaymentVerification> {
      const response = await call(resolved, RETRIEVE_PATH, { locale: 'tr', token })

      // İki ayrı durum alanı var: `status` çağrının kendisi, `paymentStatus`
      // tahsilatın sonucu. İkisi de başarılı değilse ödeme yapılmamıştır.
      const callOk = readString(response, 'status') === 'success'
      const paymentOk = readString(response, 'paymentStatus') === 'SUCCESS'

      return {
        provider: 'iyzico',
        conversationId: readString(response, 'conversationId'),
        providerPaymentId: readString(response, 'paymentId'),
        status: callOk && paymentOk ? 'success' : 'failed',
        paidPrice: readNumber(response, 'paidPrice'),
        currency: readString(response, 'currency'),
        failureMessage: readString(response, 'errorMessage'),
        raw: response as Json,
      }
    },
  }
}

/* ------------------------------------------------------------------------- *
 * HTTP + imzalama
 * ------------------------------------------------------------------------- */

function readConfig(): IyzicoConfig {
  const env = serverEnv()
  const apiKey = env.IYZICO_API_KEY ?? ''
  const secretKey = env.IYZICO_SECRET_KEY ?? ''

  if (apiKey === '' || secretKey === '') {
    throw new Error(
      'IYZICO_API_KEY / IYZICO_SECRET_KEY tanımlı değil. Kimlik bilgisi olmadan gerçek ödeme alınamaz.',
    )
  }

  return { apiKey, secretKey, baseUrl: env.IYZICO_BASE_URL.replace(/\/$/, '') }
}

async function call(
  config: IyzicoConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const payload = JSON.stringify(body)
  const randomKey = `${Date.now()}${randomBytes(6).toString('hex')}`

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-iyzi-rnd': randomKey,
      authorization: authorizationHeader(config, randomKey, path, payload),
    },
    body: payload,
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const text = await response.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`iyzico yanıtı çözümlenemedi (HTTP ${response.status}).`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`iyzico beklenmeyen bir yanıt döndü (HTTP ${response.status}).`)
  }

  return parsed as Record<string, unknown>
}

/**
 * `IYZWSv2 base64(apiKey:...&randomKey:...&signature:...)`
 * İmza `randomKey + uriPath + requestBody` üzerinden HMAC-SHA256'dır.
 */
export function authorizationHeader(
  config: Pick<IyzicoConfig, 'apiKey' | 'secretKey'>,
  randomKey: string,
  uriPath: string,
  requestBody: string,
): string {
  const signature = createHmac('sha256', config.secretKey)
    .update(`${randomKey}${uriPath}${requestBody}`)
    .digest('hex')

  const authorizationString = `apiKey:${config.apiKey}&randomKey:${randomKey}&signature:${signature}`
  return `IYZWSv2 ${Buffer.from(authorizationString, 'utf8').toString('base64')}`
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' && value !== '' ? value : null
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
