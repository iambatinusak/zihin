'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getPurchasablePackage } from '@/lib/data/billing'
import { grantSubscription as writeSubscription } from '@/lib/billing/store'
import { GrantSubscriptionSchema } from './schemas'

/**
 * Elle abonelik tanımlama (spec §M14).
 *
 * ── NEDEN VAR ──────────────────────────────────────────────────────────────
 * Havale/EFT, kurumsal satış ve destek kararları (telafi) ödeme sağlayıcısının
 * dışında kalır. Bu action o boşluğu kapatır ve kaydı `source='manual'` ile
 * işaretler; muhasebe tarafında iyzico tahsilatlarıyla karışmaz.
 *
 * ── YETKİ ──────────────────────────────────────────────────────────────────
 * YALNIZCA `admin`. `editor` yönetim panelini paylaşır ama para tarafına
 * giremez. Denetim burada yapılır, sayfada değil: bir Server Action herkese
 * açık bir uç noktadır ve düzenin (layout) guard'ı onu korumaz
 * (CONVENTIONS §3).
 */

export type GrantSubscriptionResult = {
  email: string
  endsAt: string
  /** Kullanıcının zaten süren bir aboneliği vardı; süre üstüne eklendi. */
  extended: boolean
}

export const grantSubscription = action(
  GrantSubscriptionSchema,
  async (input): Promise<GrantSubscriptionResult> => {
    await assertRole('admin')

    const admin = createSupabaseAdminClient()

    const userId = await findUserIdByEmail(admin, input.email)
    if (!userId) throw new AppError('not_found', 'Bu e-posta adresiyle bir hesap bulunamadı.')

    const pkg = await getPurchasablePackage(admin, input.packageId)

    const result = await writeSubscription(admin, {
      userId,
      packageId: pkg.id,
      // Süre verilmediyse paketin kendi süresi. Fiyat HİÇ okunmaz: elle
      // tanımlama bir tahsilat değildir, `payments` satırı açmaz.
      durationDays: input.durationDays ?? pkg.durationDays,
      source: 'manual',
      paymentRef: null,
    })

    revalidatePath('/admin/abonelikler')

    return { email: input.email, endsAt: result.endsAt, extended: !result.duplicate }
  },
)

/**
 * E-postadan kullanıcı kimliği.
 *
 * E-posta `auth.users` içindedir, `profiles` içinde değil; bu yüzden PostgREST
 * ile aranamaz ve GoTrue yönetim API'si sayfalanarak taranır.
 *
 * SINIR: en fazla `MAX_PAGES * PAGE_SIZE` kullanıcı taranır. Kullanıcı sayısı
 * bunu aşınca arama, e-postayı `profiles` üzerine taşıyan bir migration ya da
 * bir `auth.users` görünümü ister — o zamana kadar yanlış "bulunamadı" demek,
 * yanlış hesaba abonelik açmaktan iyidir.
 */
const PAGE_SIZE = 200
const MAX_PAGES = 25

async function findUserIdByEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase()

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) throw new AppError('internal', 'Kullanıcı listesi okunamadı.')

    const users = data?.users ?? []
    const match = users.find((user) => (user.email ?? '').toLowerCase() === target)
    if (match) return match.id

    if (users.length < PAGE_SIZE) return null
  }

  return null
}
