import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { APP_URL } from '@/lib/env'
import { getBillingProvider } from '@/lib/billing'
import { decideWebhookOutcome, type PaymentRecord } from '@/lib/billing/verify'
import { grantSubscription, setPaymentStatus } from '@/lib/billing/store'
import { toAmount } from '@/lib/billing/money'
import { getPaymentByProviderRef } from '@/lib/data/billing'
import type { DataClient } from '@/lib/data/client'

/**
 * iyzico ödeme dönüşü (spec §M14).
 *
 * ── BU ROTA KİMLİK DOĞRULAMASINDAN MUAFTIR, DOĞRULAMADAN DEĞİL ─────────────
 * `middleware.ts` `/api/webhooks/*` yolunu oturum zorunluluğundan muaf tutar;
 * sağlayıcının bizde bir oturumu yok. Bunun bedeli şudur: BU UÇ NOKTAYA
 * İNTERNETTEKİ HERKES POST EDEBİLİR. Gövdedeki "status: success" alanına
 * inanan bir uygulama, form gönderebilen herkese bedava abonelik dağıtan bir
 * uygulamadır.
 *
 * Bu yüzden gövdeden ALINAN TEK ŞEY `token` değeridir — bir arama anahtarı,
 * bir iddia değil. Ödemenin gerçekten olup olmadığı iyzico'ya AYRI BİR
 * İSTEKLE sorulur (`retrievePayment`) ve dönen yanıt bizim `payments`
 * satırımızla üç noktada karşılaştırılır: durum, tutar, para birimi
 * (lib/billing/verify.ts). Uyuşmayan hiçbir şey abonelik açmaz.
 *
 * ── İDEMPOTENSİ ────────────────────────────────────────────────────────────
 * iyzico teslimatı tekrarlayabilir. `payments` üzerindeki
 * `(provider, provider_ref)` kısmi tekil indeksi aynı referansla ikinci bir
 * kayıt açılmasını zaten engeller; buna ek olarak zaten `success` olan bir
 * ödeme `already_processed` sayılır ve `grantSubscription` aynı `payment_ref`
 * ile açılmış aboneliği bulup yenisini yazmaz. İki kez teslim edilen bir
 * webhook tek abonelik üretir.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Kullanıcının döneceği sonuç sayfası. */
const RESULT_PATH = '/odeme/sonuc'

export async function POST(request: Request): Promise<Response> {
  const token = await readToken(request)

  if (!token) {
    console.warn('[webhook:iyzico] token taşımayan istek reddedildi')
    return redirectToResult('failed')
  }

  const provider = getBillingProvider()
  const admin = createSupabaseAdminClient()

  try {
    // ① Sağlayıcıya SOR. Gövdeye değil, bu yanıta güveniyoruz.
    const verification = await provider.retrievePayment(token)

    const conversationId = verification.conversationId
    if (!conversationId) {
      console.warn('[webhook:iyzico] sağlayıcı eşleştirme anahtarı döndürmedi')
      return redirectToResult('failed')
    }

    // ② Kendi defterimizdeki satırı bul.
    const row = await getPaymentByProviderRef(admin, provider.name, conversationId)
    if (!row) {
      // Bizim açmadığımız bir referans: uydurulmuş ya da başka ortama ait.
      console.warn(`[webhook:iyzico] eşleşen payments satırı yok: ${conversationId}`)
      return redirectToResult('failed')
    }

    const payment: PaymentRecord = {
      id: row.id,
      userId: row.user_id,
      packageId: row.package_id,
      providerRef: row.provider_ref,
      amount: toAmount(row.amount),
      currency: row.currency,
      status: row.status,
    }

    // ③ Karar saf fonksiyonda verilir; burada yalnızca uygulanır.
    const decision = decideWebhookOutcome(payment, verification)

    switch (decision.kind) {
      case 'already_processed':
        return redirectToResult('success')

      case 'failed':
        await setPaymentStatus(admin, payment.id, 'failed', verification.raw)
        console.warn(`[webhook:iyzico] ödeme başarısız (${payment.id}): ${decision.reason}`)
        return redirectToResult('failed')

      case 'mismatch':
        // Kayıt `pending` BIRAKILIR: burası ya bir saldırı ya da bir mutabakat
        // hatasıdır; ikisi de otomatik kapatılmamalı, insan gözü istemeli.
        console.error(`[webhook:iyzico] DOĞRULAMA UYUŞMAZLIĞI (${payment.id}): ${decision.reason}`)
        return redirectToResult('failed')

      case 'grant':
        await activate(admin, payment, verification.raw)
        return redirectToResult('success')
    }
  } catch (error) {
    // Sağlayıcıya ulaşılamadıysa ödeme kaydına DOKUNULMAZ; `pending` kalır ve
    // sağlayıcının bir sonraki teslimatında yeniden değerlendirilir.
    console.error('[webhook:iyzico] işlenemedi:', error)
    return redirectToResult('pending')
  }
}

/** GET ile çağrılan bir webhook yoktur; yan etkili uçlar POST'tur. */
export async function GET(): Promise<Response> {
  return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } })
}

/* ------------------------------------------------------------------------- *
 * Yardımcılar
 * ------------------------------------------------------------------------- */

async function activate(
  admin: DataClient,
  payment: PaymentRecord,
  raw: Parameters<typeof setPaymentStatus>[3],
): Promise<void> {
  if (!payment.packageId) {
    throw new Error(`ödeme paketsiz, abonelik açılamaz: ${payment.id}`)
  }

  const { data: pkg, error } = await admin
    .from('packages')
    .select('duration_days')
    .eq('id', payment.packageId)
    .maybeSingle()

  if (error || !pkg) throw new Error(`paket okunamadı: ${payment.packageId}`)

  // Önce ödeme `success` yazılır: abonelik açıldığı hâlde `pending` görünen
  // bir ödeme, mutabakatta "tahsil edilmemiş" sayılırdı.
  await setPaymentStatus(admin, payment.id, 'success', raw)

  await grantSubscription(admin, {
    userId: payment.userId,
    packageId: payment.packageId,
    durationDays: pkg.duration_days,
    source: 'iyzico',
    paymentRef: payment.providerRef,
  })
}

/**
 * Gövdeden yalnızca `token` okunur. iyzico Checkout Form dönüşü
 * `application/x-www-form-urlencoded` gönderir; sandbox testlerinde JSON da
 * görülebildiği için ikisi de kabul edilir.
 */
async function readToken(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      const body: unknown = await request.json()
      if (typeof body === 'object' && body !== null) {
        const value = (body as Record<string, unknown>).token
        return typeof value === 'string' && value !== '' ? value : null
      }
      return null
    }

    const form = await request.formData()
    const value = form.get('token')
    return typeof value === 'string' && value !== '' ? value : null
  } catch {
    return null
  }
}

/**
 * Kullanıcıyı sonuç sayfasına yollar. 303: tarayıcı POST'u GET'e çevirsin,
 * yenilemede ikinci bir POST gitmesin.
 */
function redirectToResult(status: 'success' | 'failed' | 'pending'): Response {
  const url = new URL(RESULT_PATH, APP_URL)
  url.searchParams.set('durum', status)
  return new Response(null, { status: 303, headers: { location: url.toString() } })
}
