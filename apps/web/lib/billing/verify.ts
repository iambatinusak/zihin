/**
 * Webhook doğrulama kararı — saf fonksiyon, ağ ve veritabanı tanımaz.
 *
 * ── NEDEN AYRI BİR DOSYA ───────────────────────────────────────────────────
 * "Abonelik ver mi?" sorusu paranın döndüğü tek karar noktasıdır ve bu yüzden
 * test edilebilir olmak zorundadır. Rota yalnızca veriyi toplar, kararı burası
 * verir, rota kararı uygular.
 *
 * ── DOĞRULANAN ÜÇ ŞEY ──────────────────────────────────────────────────────
 *  1. Sağlayıcı ödemeyi BAŞARILI diyor mu? (gövde değil, çekilen yanıt)
 *  2. Tahsil edilen tutar bizim `payments` satırımızdaki tutarla aynı mı?
 *  3. Para birimi aynı mı?
 * Tutar denetimi olmadan saldırgan 1 TL'lik bir oturum açıp 4.490 TL'lik
 * paketin aboneliğini alabilirdi.
 */

import { amountsEqual } from './money'
import type { PaymentVerification } from './provider'

/** `payments` satırının karar için gereken en az bilgisi. */
export type PaymentRecord = {
  id: string
  userId: string
  packageId: string | null
  /** Sağlayıcının işlem anahtarı; abonelik satırının `payment_ref` alanı. */
  providerRef: string | null
  amount: number
  currency: string
  status: 'pending' | 'success' | 'failed' | 'refunded'
}

export type WebhookDecision =
  /** Tahsilat doğrulandı; ödeme `success` yazılıp abonelik açılmalı. */
  | { kind: 'grant' }
  /**
   * Bu ödeme zaten işlenmiş. İkinci teslimat (iyzico webhook'u tekrar dener)
   * hiçbir şey yapmadan 200 döner — aksi hâlde iki abonelik açılırdı.
   */
  | { kind: 'already_processed' }
  /** Sağlayıcı ödemeyi başarısız diyor; kayıt `failed` yazılır. */
  | { kind: 'failed'; reason: string }
  /**
   * Sağlayıcının yanıtı bizim kaydımızla uyuşmuyor. Abonelik AÇILMAZ ve kayıt
   * `pending` bırakılır: burası bir saldırı ya da bir mutabakat hatasıdır,
   * ikisi de insan gözü ister.
   */
  | { kind: 'mismatch'; reason: string }

export function decideWebhookOutcome(
  payment: PaymentRecord,
  verification: PaymentVerification,
): WebhookDecision {
  // İDEMPOTENSİ: karar zinciri buradan başlar. Zaten başarılı bir ödemeye
  // ikinci kez dokunulmaz; `refunded` bir ödeme de yeniden canlandırılmaz.
  if (payment.status === 'success' || payment.status === 'refunded') {
    return { kind: 'already_processed' }
  }

  if (verification.status !== 'success') {
    return { kind: 'failed', reason: verification.failureMessage ?? 'Ödeme tamamlanmadı.' }
  }

  const currency = verification.currency ?? payment.currency
  if (currency.toUpperCase() !== payment.currency.toUpperCase()) {
    return {
      kind: 'mismatch',
      reason: `Para birimi uyuşmuyor: beklenen ${payment.currency}, gelen ${currency}`,
    }
  }

  if (verification.paidPrice === null) {
    return { kind: 'mismatch', reason: 'Sağlayıcı tahsil edilen tutarı bildirmedi.' }
  }

  if (!amountsEqual(verification.paidPrice, payment.amount)) {
    return {
      kind: 'mismatch',
      reason: `Tutar uyuşmuyor: beklenen ${payment.amount}, tahsil edilen ${verification.paidPrice}`,
    }
  }

  return { kind: 'grant' }
}
