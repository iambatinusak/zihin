'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/data/admin'
import { anonymizedEmail, anonymizedProfileFields } from '@/lib/admin/anonymize'
import {
  ANONYMIZE_CONFIRMATION,
  AnonymizeUserSchema,
  ChangeRoleSchema,
  SetSuspensionSchema,
} from './schemas'

/**
 * Kullanıcı yönetimi (spec §M15, §10).
 *
 * ── YETKİ: HEPSİ SADECE `admin` ─────────────────────────────────────────────
 * `(admin)/layout.tsx` düzeni `editor`'ü de içeri alır. Bu dosyadaki hiçbir
 * işlem editöre AÇIK DEĞİLDİR ve bunu sağlayan şey menüde düğmeyi gizlemek
 * değil, her action'ın ilk satırındaki `assertRole('admin')`tır. Server Action
 * kendi başına çağrılabilen bir uç noktadır (CONVENTIONS §3).
 *
 * ── TRIGGER TUZAĞI ──────────────────────────────────────────────────────────
 * `profiles` üzerindeki `protect_profile_fields` trigger'ı (0011) `role`, `xp`,
 * `suspended_at` gibi kolonlardaki değişikliği SESSİZCE eski değerine döndürür
 * — hata fırlatmaz. Yani "kaydedildi" demek yetmez, yazının GERÇEKTEN indiğini
 * doğrulamak gerekir.
 *
 * Trigger'ın muafiyet listesi: `service_role`, `supabase_admin`, `postgres` ve
 * `public.is_admin()`. Yani yöneticinin KENDİ oturum istemcisi de muaftır;
 * ayrıca 0011'deki `profiles_update_self_or_admin` politikası admine başka
 * kullanıcının satırını güncelleme izni verir. Bu yüzden rol değişikliği ve
 * askıya alma OTURUM İSTEMCİSİYLE yapılır — RLS ikinci güvenlik ağı olarak
 * açık kalsın diye. Service-role yalnızca PostgREST'in erişemediği yerde
 * kullanılır: `auth.users` (e-posta, GoTrue yasağı).
 *
 * Her yazmadan sonra satır yeniden okunur ve beklenen değer doğrulanır; sessiz
 * geri alma "başarılı" olarak raporlanmaz.
 */

const PATH = '/admin/kullanicilar'

export type ChangeRoleResult = { userId: string; role: Role; roleLabel: string }

/**
 * Rol değiştirme. YALNIZCA `admin`.
 *
 * Yönetici kendi rolünü düşüremez: son yönetici kendini editöre çevirirse
 * panele giren kimse kalmaz ve geri dönüşün yolu yalnızca veritabanıdır.
 */
export const changeUserRole = action(ChangeRoleSchema, async (input): Promise<ChangeRoleResult> => {
  const actor = await assertRole('admin')

  if (actor.id === input.userId && input.role !== 'admin') {
    throw new AppError('conflict', 'Kendi yönetici rolünüzü kaldıramazsınız.')
  }

  const supabase = await createSupabaseServerClient()
  const target = await getAdminUser(supabase, input.userId)
  if (target.role === input.role) {
    return { userId: input.userId, role: input.role, roleLabel: ROLE_LABELS[input.role] }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: input.role })
    .eq('id', input.userId)

  if (error) {
    console.error('[kullanicilar] rol yazma hatası:', error)
    throw new AppError('internal', 'Rol güncellenemedi.')
  }

  // Trigger sessizce geri alsaydı burada ESKİ rol okunurdu.
  const after = await getAdminUser(supabase, input.userId)
  if (after.role !== input.role) {
    throw new AppError(
      'forbidden',
      'Rol değişikliği veritabanı tarafından geri alındı. Yönetici yetkiniz doğrulanamadı.',
    )
  }

  revalidatePath(PATH)
  return { userId: input.userId, role: input.role, roleLabel: ROLE_LABELS[input.role] }
})

export type SuspensionResult = { userId: string; suspended: boolean }

/**
 * Askıya alma / yeniden etkinleştirme. YALNIZCA `admin`.
 *
 * İKİ KATMAN, bilerek:
 *  1. `profiles.suspended_at` — uygulamanın gördüğü kaynak. `lib/auth.ts`
 *     içindeki oturum çözümlemesi bunu okur; askıdaki hesap ne sayfa açabilir
 *     (`requireUser` → /hesap-askida) ne de action çağırabilir (`assertRole`
 *     → `forbidden`).
 *  2. GoTrue yasağı (`ban_duration`) — token yenilemeyi de keser. Yalnızca (1)
 *     olsaydı kullanıcının elindeki erişim jetonu süresi dolana kadar geçerli
 *     kalırdı; uygulama yine de her istekte engellerdi ama oturum "canlı"
 *     görünürdü.
 *
 * Sıra önemli: önce yasak, sonra profil. Profil yazması başarısız olursa yasak
 * geri alınır — iki katman ayrık kalmasın.
 */
const BAN_DURATION = '876000h' // ~100 yıl; GoTrue süresiz yasak kabul etmiyor.

export const setUserSuspension = action(
  SetSuspensionSchema,
  async (input): Promise<SuspensionResult> => {
    const actor = await assertRole('admin')

    if (actor.id === input.userId) {
      throw new AppError('conflict', 'Kendi hesabınızı askıya alamazsınız.')
    }

    const supabase = await createSupabaseServerClient()
    await getAdminUser(supabase, input.userId)

    const admin = createSupabaseAdminClient()
    const { error: banError } = await admin.auth.admin.updateUserById(input.userId, {
      ban_duration: input.suspended ? BAN_DURATION : 'none',
    })
    if (banError) {
      console.error('[kullanicilar] oturum yasağı hatası:', banError)
      throw new AppError('internal', 'Hesap durumu güncellenemedi.')
    }

    const suspendedAt = input.suspended ? new Date().toISOString() : null
    const { error } = await supabase
      .from('profiles')
      .update({ suspended_at: suspendedAt })
      .eq('id', input.userId)

    if (error) {
      await admin.auth.admin.updateUserById(input.userId, {
        ban_duration: input.suspended ? 'none' : BAN_DURATION,
      })
      console.error('[kullanicilar] askı yazma hatası:', error)
      throw new AppError('internal', 'Hesap durumu güncellenemedi.')
    }

    const after = await getAdminUser(supabase, input.userId)
    if ((after.suspended_at !== null) !== input.suspended) {
      throw new AppError(
        'forbidden',
        'Hesap durumu veritabanı tarafından geri alındı. Yönetici yetkiniz doğrulanamadı.',
      )
    }

    revalidatePath(PATH)
    return { userId: input.userId, suspended: input.suspended }
  },
)

export type AnonymizeResult = { userId: string }

/**
 * KVKK anonimleştirme (spec §10). YALNIZCA `admin`. GERİ ALINAMAZ.
 *
 * SİLİNEN: ad, görünen ad, avatar, davet kodu, liderlik onayı ve e-posta
 * (yönlendirilemeyen `@anonim.invalid` yer tutucusuyla değiştirilir; GoTrue
 * e-postayı benzersiz ve dolu ister, bu yüzden `null` yazılamaz).
 *
 * KORUNAN: attempts, topic_mastery, mastery_history, daily_activity,
 * xp_events, test_sessions ve payments satırlarının TAMAMI. Bu satırlar kişiyi
 * tanımlayan hiçbir alan taşımaz; profil kimliğinden koptukları anda
 * istatistiktirler. Silinmeleri soru kalibrasyonunu bozar, ödeme kayıtlarında
 * ise saklama yükümlülüğüne aykırı düşer.
 *
 * Alan eşlemesinin kendisi `lib/admin/anonymize.ts` içinde ve testlidir.
 *
 * Hesap ayrıca askıya alınır: anonimleştirilen kişi hesabını kullanmaya devam
 * edemez, aksi hâlde yeni etkinlik yeniden kimliklendirme riski doğurur.
 */
export const anonymizeUser = action(
  AnonymizeUserSchema,
  async (input): Promise<AnonymizeResult> => {
    const actor = await assertRole('admin')

    if (input.confirmation !== ANONYMIZE_CONFIRMATION) {
      throw new AppError(
        'validation',
        `Onaylamak için kutuya "${ANONYMIZE_CONFIRMATION}" yazmalısınız.`,
        { confirmation: ['Onay metni eşleşmiyor.'] },
      )
    }
    if (actor.id === input.userId) {
      throw new AppError('conflict', 'Kendi hesabınızı anonimleştiremezsiniz.')
    }

    const supabase = await createSupabaseServerClient()
    await getAdminUser(supabase, input.userId)

    const admin = createSupabaseAdminClient()

    // E-posta ve oturum yasağı `auth.users` üzerindedir; PostgREST o şemayı
    // açmaz, bu adım zorunlu olarak service-role ile yapılır.
    const { error: authError } = await admin.auth.admin.updateUserById(input.userId, {
      email: anonymizedEmail(input.userId),
      ban_duration: BAN_DURATION,
    })
    if (authError) {
      console.error('[kullanicilar] anonimleştirme (auth) hatası:', authError)
      throw new AppError('internal', 'Kullanıcı anonimleştirilemedi.')
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ...anonymizedProfileFields(), suspended_at: new Date().toISOString() })
      .eq('id', input.userId)

    if (error) {
      console.error('[kullanicilar] anonimleştirme (profil) hatası:', error)
      throw new AppError('internal', 'Kullanıcı anonimleştirilemedi.')
    }

    const after = await getAdminUser(supabase, input.userId)
    if (after.suspended_at === null || after.full_name !== anonymizedProfileFields().full_name) {
      throw new AppError(
        'forbidden',
        'Anonimleştirme veritabanı tarafından geri alındı. Yönetici yetkiniz doğrulanamadı.',
      )
    }

    revalidatePath(PATH)
    return { userId: input.userId }
  },
)
