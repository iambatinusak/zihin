/**
 * Ödeme sağlayıcı sözleşmesi (spec §M14).
 *
 * MVP'de iyzico Checkout Form kullanılıyor; kimlik bilgisi olmayan bir
 * geliştirme ortamında da akışın çalışabilmesi için sahte bir sağlayıcı var.
 * Checkout action'ı ve webhook rotası hangisinin yürürlükte olduğunu
 * bilmemeli, bu yüzden imzalar arada bir soyutlamayla ayrılır
 * (lib/video/provider.ts ile aynı biçim).
 */

import type { Json } from '@zihin/db/types'

export type BillingProviderName = 'iyzico' | 'mock'

/**
 * Ödeme başlatma isteği.
 *
 * DİKKAT: `amountTry` her zaman SUNUCUDA `packages.price_try` kolonundan
 * okunur. Bu tipin bir alanı olması onu istemciden gelebilir yapmaz; tarayıcı
 * yalnızca bir paket kimliği gönderir (bkz. app/(student)/odeme/schemas.ts).
 */
export type CheckoutRequest = {
  /** Bizim ürettiğimiz eşleştirme anahtarı; `payments.provider_ref` olur. */
  conversationId: string
  /** Sunucuda okunan etiket fiyatı, TRY. */
  amountTry: number
  packageId: string
  packageName: string
  buyer: {
    id: string
    name: string
    surname: string
    email: string
    /** Sağlayıcı risk denetimi için ister; bilinmiyorsa yerel adres. */
    ip: string
  }
  /** Sağlayıcının ödeme sonrası POST edeceği adres (webhook rotamız). */
  callbackUrl: string
}

/** Sağlayıcının açtığı ödeme oturumu. */
export type CheckoutSession = {
  provider: BillingProviderName
  /** Sağlayıcı tarafındaki oturum anahtarı; doğrulama bununla yapılır. */
  token: string
  /** Kullanıcının yönlendirileceği ödeme sayfası. */
  paymentPageUrl: string
  /** Ham yanıt; mutabakat ve hata ayıklama için `payments.raw` içine yazılır. */
  raw: Json
}

/**
 * Sağlayıcıdan ÇEKİLEN ödeme durumu.
 *
 * Webhook gövdesinden değil, sağlayıcıya yapılan ikinci bir çağrıdan gelir —
 * gövde saldırgan tarafından yazılabilir, sağlayıcının yanıtı yazılamaz.
 */
export type PaymentVerification = {
  provider: BillingProviderName
  /** Sağlayıcının bize geri verdiği eşleştirme anahtarı. */
  conversationId: string | null
  /** Sağlayıcının kendi işlem kimliği. */
  providerPaymentId: string | null
  status: 'success' | 'failed'
  /** Gerçekten tahsil edilen tutar. */
  paidPrice: number | null
  currency: string | null
  /** Sağlayıcı hata kodu/mesajı (varsa). */
  failureMessage: string | null
  raw: Json
}

export interface BillingProvider {
  readonly name: BillingProviderName
  /**
   * Gerçek bir tahsilat yapılmıyorsa `true`. Arayüz bunu görünür bir uyarıya
   * çevirmek ZORUNDADIR — sahte bir ödeme asla gerçekmiş gibi gösterilmez.
   */
  readonly isMock: boolean

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>

  /** Sağlayıcıdaki ödemeyi token ile çeker. Ağ hatasında fırlatır. */
  retrievePayment(token: string): Promise<PaymentVerification>
}

/** Ödeme kaydının para birimi. Tek para birimi var; sabit tutulur. */
export const BILLING_CURRENCY = 'TRY'

/**
 * Sağlayıcı seçimi ORTAMDAN gelir, istekten değil.
 *
 * `IYZICO_API_KEY` doluysa gerçek sağlayıcı, boşsa sahte sağlayıcı. Bir HTTP
 * isteği bu karara karışamaz — karışabilseydi, sahte sağlayıcıyı seçip bedava
 * abonelik almak bir sorgu parametresi kadar uzakta olurdu.
 *
 * Saf fonksiyon olarak burada duruyor ki testten `server-only` modüllerine
 * dokunmadan çağrılabilsin.
 */
export function selectBillingProviderName(apiKey: string | undefined | null): BillingProviderName {
  return typeof apiKey === 'string' && apiKey.trim() !== '' ? 'iyzico' : 'mock'
}
