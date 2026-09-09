'use server'

import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { APP_URL } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getPurchasablePackage } from '@/lib/data/billing'
import { getBillingProvider } from '@/lib/billing'
import { createPendingPayment } from '@/lib/billing/store'
import { CreateCheckoutSchema } from './schemas'

/**
 * Ödeme akışının mutasyonları (spec §M14).
 *
 * ── PARANIN ÜÇ KURALI ──────────────────────────────────────────────────────
 * 1. FİYAT İSTEMCİDEN GELMEZ. Girdi yalnızca `packageId`; tutar burada
 *    `packages.price_try` kolonundan okunur. Bir Server Action herkese açık
 *    bir uç noktadır: tarayıcının hesapladığı hiçbir sayıya güvenilmez.
 * 2. ABONELİĞİ BU DOSYA AÇMAZ. Burada yalnızca `pending` bir ödeme kaydı
 *    açılır ve kullanıcı sağlayıcıya yönlendirilir. "Ödeme başarılı" bilgisi
 *    tarayıcıdan geldiğinde hiçbir değeri yoktur; abonelik yalnızca
 *    doğrulanmış webhook'ta açılır (app/api/webhooks/iyzico/route.ts).
 * 3. ÖNCE KAYIT, SONRA YÖNLENDİRME. Sağlayıcıya gitmeden `payments` satırı
 *    yazılır; aksi hâlde tahsil edilmiş ama karşılığı hiçbir yerde
 *    görünmeyen bir ödeme mümkün olurdu.
 */

export type CreateCheckoutResult = {
  /** Kullanıcının yönlendirileceği ödeme sayfası. */
  paymentPageUrl: string
  /** Gerçek bir tahsilat yapılmayacaksa arayüz uyarı bandını gösterir. */
  isMock: boolean
  amountTry: number
  packageName: string
}

export const createCheckout = action(
  CreateCheckoutSchema,
  async (input): Promise<CreateCheckoutResult> => {
    const user = await assertRole('student')
    const supabase = await createSupabaseServerClient()

    // Tutarın tek kaynağı: satıştaki paketin veritabanındaki fiyatı.
    const pkg = await getPurchasablePackage(supabase, input.packageId)

    // Paket bir sınava bağlıysa öğrencinin hedef sınavıyla uyuşmalı; yanlış
    // paket satın alıp erişemediği içeriğe para vermesin.
    if (pkg.examId !== null && user.examId !== null && pkg.examId !== user.examId) {
      throw new AppError('forbidden', 'Bu paket hedeflediğiniz sınava ait değil.')
    }

    const provider = getBillingProvider()
    const conversationId = randomUUID()
    const admin = createSupabaseAdminClient()

    // 1) Önce defter satırı.
    await createPendingPayment(admin, {
      userId: user.id,
      packageId: pkg.id,
      amount: pkg.priceTry,
      provider: provider.name,
      providerRef: conversationId,
    })

    // 2) Sonra sağlayıcı oturumu.
    const { name, surname } = splitName(user.fullName ?? user.displayName)

    const session = await provider.createCheckout({
      conversationId,
      amountTry: pkg.priceTry,
      packageId: pkg.id,
      packageName: pkg.name,
      buyer: {
        id: user.id,
        name,
        surname,
        email: user.email,
        ip: await clientIp(),
      },
      callbackUrl: `${APP_URL}/api/webhooks/iyzico`,
    })

    return {
      paymentPageUrl: session.paymentPageUrl,
      isMock: provider.isMock,
      amountTry: pkg.priceTry,
      packageName: pkg.name,
    }
  },
)

/** iyzico ad ve soyadı ayrı ister; tek parçalı adlarda soyad yer tutucudur. */
function splitName(fullName: string | null): { name: string; surname: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: 'Zihin', surname: 'Kullanıcı' }
  if (parts.length === 1) return { name: parts[0] as string, surname: '-' }
  return { name: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] as string }
}

/** Sağlayıcı risk denetimi için IP ister; vekil başlığı yoksa yerel adres. */
async function clientIp(): Promise<string> {
  const store = await headers()
  const forwarded = store.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first && first !== '' ? first : '127.0.0.1'
}
