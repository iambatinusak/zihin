import 'server-only'

import type { Json } from '@zihin/db/types'
import type { DataClient } from '@/lib/data/client'
import { getActiveSubscription } from '@/lib/data/billing'
import { extendedPeriod } from './period'
import type { BillingProviderName } from './provider'
import { BILLING_CURRENCY } from './provider'

/**
 * `payments` ve `subscriptions` yazımlarının TEK noktası.
 *
 * Her iki tablo da service-role'a kapalıdır demiyoruz — tam tersi: istemciye
 * kapalıdır. `subscriptions` tablosunun hiçbir insert/update politikası yok
 * (0011_rls_policies.sql), `payments` yalnızca okunabilir. Dolayısıyla
 * buradaki fonksiyonlar `createSupabaseAdminClient()` bekler ve yalnızca
 * webhook, cron ve yönetici action'ından çağrılır.
 */

export type PendingPaymentInput = {
  userId: string
  packageId: string
  /** SUNUCUDA `packages.price_try` kolonundan okunmuş tutar. */
  amount: number
  provider: BillingProviderName
  /** Bizim ürettiğimiz eşleştirme anahtarı. */
  providerRef: string
}

/**
 * Ödemeyi `pending` olarak kaydeder.
 *
 * SAĞLAYICIYA YÖNLENDİRMEDEN ÖNCE çağrılır: kullanıcı ödeme sayfasına gidip
 * kartı çektirdikten sonra bizim tarafta hiçbir iz kalmaması, tahsil edilmiş
 * ama karşılığı olmayan bir para demektir. Önce satır, sonra yönlendirme.
 */
export async function createPendingPayment(
  admin: DataClient,
  input: PendingPaymentInput,
): Promise<string> {
  const { data, error } = await admin
    .from('payments')
    .insert({
      user_id: input.userId,
      package_id: input.packageId,
      amount: input.amount,
      currency: BILLING_CURRENCY,
      provider: input.provider,
      provider_ref: input.providerRef,
      status: 'pending',
      raw: {},
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new Error(`payments kaydı açılamadı: ${error?.message ?? 'satır dönmedi'}`)
  }

  return data.id
}

/**
 * Ödeme kaydının durumunu ve ham yanıtını günceller.
 *
 * `payments` tasarımda salt-ekleme bir defter (0009_commerce.sql), ama
 * `(provider, provider_ref)` üzerinde kısmi tekil indeks var: aynı referansla
 * ikinci bir satır zaten yazılamaz. Bu yüzden durum geçişi aynı satırda
 * yapılır; defterin değişmeyen kısmı tutar, para birimi ve referanstır.
 */
export async function setPaymentStatus(
  admin: DataClient,
  paymentId: string,
  status: 'success' | 'failed' | 'refunded',
  raw: Json,
): Promise<void> {
  const { error } = await admin.from('payments').update({ status, raw }).eq('id', paymentId)
  if (error) throw new Error(`payments güncellenemedi: ${error.message}`)
}

export type GrantSubscriptionInput = {
  userId: string
  packageId: string
  durationDays: number
  source: 'iyzico' | 'manual'
  /** `payments.provider_ref` ile eşleşir; elle tanımlamada null. */
  paymentRef: string | null
}

export type GrantSubscriptionResult = {
  subscriptionId: string
  startsAt: string
  endsAt: string
  /** Zaten var olan bir abonelik bulunduysa yenisi açılmadı. */
  duplicate: boolean
}

/**
 * Aboneliği açar.
 *
 * ── İDEMPOTENSİ ────────────────────────────────────────────────────────────
 * `paymentRef` verilmişse önce o referansla açılmış bir abonelik aranır. İkinci
 * kez teslim edilen bir webhook böylece ikinci abonelik yaratmaz.
 *
 * Ama oku-sonra-yaz tek başına bir YARIŞTIR: aynı webhook milisaniyeler arayla
 * iki kez teslim edilirse iki istek de "bulamadım" diyebilir. Bu yüzden asıl
 * kilit veritabanındadır — `idx_subscriptions_payment_ref_unique`
 * (0015_billing_idempotency.sql): bir ödeme referansı en fazla bir abonelik
 * açar. Aşağıdaki 23505 dalı o kilide çarpan ikinci isteği hata değil,
 * `duplicate` sayar; çünkü sonuç doğrudur, abonelik açılmıştır.
 *
 * ── UZATMA ─────────────────────────────────────────────────────────────────
 * Kullanıcının hâlâ süren bir aboneliği varsa yeni dönem onun bitişinden
 * başlar; ödediği gün yanmaz.
 */
export async function grantSubscription(
  admin: DataClient,
  input: GrantSubscriptionInput,
  now: Date = new Date(),
): Promise<GrantSubscriptionResult> {
  if (input.paymentRef !== null) {
    const { data: existing } = await admin
      .from('subscriptions')
      .select('id, starts_at, ends_at')
      .eq('payment_ref', input.paymentRef)
      .limit(1)

    const found = existing?.[0]
    if (found) {
      return {
        subscriptionId: found.id,
        startsAt: found.starts_at,
        endsAt: found.ends_at,
        duplicate: true,
      }
    }
  }

  const current = await getActiveSubscription(admin, input.userId)
  const period = extendedPeriod(current?.ends_at ?? null, input.durationDays, now)

  const { data, error } = await admin
    .from('subscriptions')
    .insert({
      user_id: input.userId,
      package_id: input.packageId,
      starts_at: period.startsAt,
      ends_at: period.endsAt,
      status: 'active',
      source: input.source,
      payment_ref: input.paymentRef,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    // 23505 = tekil indeks ihlali: yarışı başka bir teslimat kazandı ve
    // abonelik ZATEN açıldı. Onun satırını okuyup `duplicate` dönmek doğru
    // cevaptır; hata fırlatmak webhook'a boşuna 500 döndürürdü.
    if (input.paymentRef !== null && (error as { code?: string } | null)?.code === '23505') {
      const { data: winner } = await admin
        .from('subscriptions')
        .select('id, starts_at, ends_at')
        .eq('payment_ref', input.paymentRef)
        .limit(1)

      const found = winner?.[0]
      if (found) {
        return {
          subscriptionId: found.id,
          startsAt: found.starts_at,
          endsAt: found.ends_at,
          duplicate: true,
        }
      }
    }

    throw new Error(`subscriptions kaydı açılamadı: ${error?.message ?? 'satır dönmedi'}`)
  }

  return {
    subscriptionId: data.id,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    duplicate: false,
  }
}
