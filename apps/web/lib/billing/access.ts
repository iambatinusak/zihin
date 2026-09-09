import 'server-only'

import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Abonelik kapısının uygulama tarafı.
 *
 * ── KARAR NEREDE VERİLİYOR ─────────────────────────────────────────────────
 * Asıl karar veritabanındaki `public.has_active_subscription(target_exam)`
 * fonksiyonundadır; RLS politikaları da aynı fonksiyonu çağırır. Buradaki
 * yardımcı onu tekrar YAZMAZ, çağırır — iki katmanın farklı cevap vermesi
 * mümkün olmasın (CONVENTIONS §3).
 *
 * ── ÜCRETSİZ ÖNİZLEME BURADA DEĞİL ─────────────────────────────────────────
 * Spec §M14: her konunun ilk 2 videosu `videos.is_free_preview` ile açıktır.
 * Bu kural İÇERİĞİN kendi kolonunda yaşar, abonelik kapısında değil; çağıran
 * taraf önce `is_free_preview` bakar, kapıya yalnızca kapalı içerik için gelir
 * (bkz. app/(student)/video/actions.ts → `assertVideoAccess`).
 */

/**
 * Kullanıcının `examId` sınavını kapsayan aktif aboneliği var mı?
 *
 * `examId` verilmezse "herhangi bir aktif abonelik" sorulur. Okuma hata
 * verirse `false` döner: belirsizlikte kısıtlı olan taraf seçilir.
 */
export async function hasSubscriptionAccess(examId?: string | null): Promise<boolean> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.rpc(
    'has_active_subscription',
    examId ? { target_exam: examId } : {},
  )

  if (error) return false
  return data === true
}

/**
 * Server Action / RSC kapısı. Aboneliği yoksa `subscription_required` fırlatır;
 * `action()` sarmalayıcısı bunu kullanıcıya Türkçe mesajla döndürür.
 */
export async function assertSubscription(examId?: string | null): Promise<void> {
  if (await hasSubscriptionAccess(examId)) return

  throw new AppError(
    'subscription_required',
    'Bu içeriğe erişmek için aktif bir aboneliğiniz olmalı.',
  )
}
