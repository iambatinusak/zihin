'use server'

import { revalidatePath } from 'next/cache'
import { action, actionNoInput } from '@/lib/action'
import { getCurrentUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
} from '@/lib/data/notifications'
import { FetchRecentNotificationsSchema, MarkNotificationReadSchema } from './schemas'

/**
 * Bildirim mutasyonları (spec §M16).
 *
 * ── ROL DEĞİL, SAHİPLİK ────────────────────────────────────────────────────
 * Bildirim her role gider: öğrenciye tekrar hatırlatması, veliye haftalık özet.
 * Bu yüzden `assertRole` ile bir rol listesi dayatılmaz; oturum aranır ve her
 * sorgu `user_id = oturumdaki kullanıcı` filtresiyle çalışır. Yetki kararı
 * "hangi rolsün" değil, "bu satır senin mi" sorusudur.
 *
 * Bir Server Action AÇIK BİR UÇTUR: istemcinin gönderdiği bildirim kimliği
 * hiçbir zaman tek başına yeterli değildir; `lib/data/notifications.ts`
 * içindeki her yazma `.eq('user_id', ...)` taşır ve RLS ayrıca aynı kuralı
 * uygular (CONVENTIONS §3).
 */

/** Oturum zorunlu; rol serbest. */
async function requireActor() {
  const user = await getCurrentUser()
  if (!user) throw new AppError('unauthenticated', 'Bu işlem için giriş yapmalısınız.')
  return user
}

export type MarkReadResult = {
  /** Bildirimin bağlantısı; istemci tıklamadan sonra buraya gider. */
  link: string | null
  unreadCount: number
}

/** Tek bildirimi okundu işaretler ve güncel rozet sayısını döner. */
export const markRead = action(
  MarkNotificationReadSchema,
  async (input): Promise<MarkReadResult> => {
    const user = await requireActor()
    const supabase = await createSupabaseServerClient()

    const { link } = await markNotificationRead(supabase, user.id, input.notificationId)
    const unreadCount = await getUnreadCount(supabase, user.id)

    revalidatePath('/bildirimler')
    return { link, unreadCount }
  },
)

export type MarkAllReadResult = {
  marked: number
  unreadCount: number
}

/** Okunmamış tüm bildirimleri işaretler. */
export const markAllRead = actionNoInput(async (): Promise<MarkAllReadResult> => {
  const user = await requireActor()
  const supabase = await createSupabaseServerClient()

  const marked = await markAllNotificationsRead(supabase, user.id)

  revalidatePath('/bildirimler')
  return { marked, unreadCount: 0 }
})

export type RecentNotifications = {
  items: NotificationRecord[]
  unreadCount: number
}

/**
 * Zil açıldığında çağrılır.
 *
 * Neden action, neden düzende önceden okunmuyor: bildirim listesi her sayfa
 * render'ında değil, yalnızca zil açıldığında gerekir. Düzene eklenseydi her
 * gezinme fazladan bir sorgu ödeyecekti — rozet sayısı zaten (çok küçük kısmi
 * indeksle) okunuyor, liste ise talep üzerine gelir.
 */
export const fetchRecentNotifications = action(
  FetchRecentNotificationsSchema,
  async (input): Promise<RecentNotifications> => {
    const user = await requireActor()
    const supabase = await createSupabaseServerClient()

    const items = await listNotifications(supabase, user.id, { limit: input.limit })
    const unreadCount = await getUnreadCount(supabase, user.id)

    return { items, unreadCount }
  },
)
