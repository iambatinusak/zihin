import 'server-only'

import type { Tables } from '@zihin/db/types'
import { AppError } from '@/lib/errors'
import type { DataClient } from './client'
import {
  isNotificationType,
  NOTIFICATION_TYPES,
  type NotificationType,
} from '@/lib/notifications/types'

type Client = DataClient

/**
 * Bildirim okuma katmanı (spec §M16).
 *
 * `notifications` satırlarını yalnızca sistem YAZAR (service-role); kullanıcıya
 * RLS ile okuma, `read_at` damgalama ve silme açıktır (0011_rls_policies.sql).
 * Buradaki her fonksiyon oturum istemcisiyle çalışır ve ayrıca `user_id`
 * filtresi koyar: RLS satırı korur, uygulama katmanı doğru cevabı verir
 * (CONVENTIONS §3).
 */

// Tür listesi istemci tarafında da gerekli; tek kaynak lib/notifications/types.ts.
export { NOTIFICATION_TYPES, isNotificationType, type NotificationType }

export type NotificationRecord = Pick<
  Tables<'notifications'>,
  'id' | 'type' | 'title' | 'body' | 'link' | 'read_at' | 'created_at'
>

/** Zil rozeti için okunmamış bildirim sayısı. */
export async function getUnreadCount(client: Client, userId: string): Promise<number> {
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)

  if (error) {
    // Rozet sayacı sayfayı düşürmez: okunamazsa rozet gösterilmez.
    console.error('[notifications] okunmamış sayısı okunamadı:', error)
    return 0
  }

  return count ?? 0
}

export type ListNotificationsOptions = {
  limit?: number
  /** Verilirse yalnızca bu türler döner. */
  types?: readonly NotificationType[]
  /** Yalnızca okunmamışlar. */
  unreadOnly?: boolean
}

/** En yeniden eskiye bildirim listesi. */
export async function listNotifications(
  client: Client,
  userId: string,
  options: ListNotificationsOptions = {},
): Promise<NotificationRecord[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)

  let query = client
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.types && options.types.length > 0) {
    query = query.in('type', [...options.types])
  }
  if (options.unreadOnly) {
    query = query.is('read_at', null)
  }

  const { data, error } = await query
  if (error) throw new AppError('internal', 'Bildirimler yüklenemedi.')

  return (data ?? []) as NotificationRecord[]
}

/** Filtre sekmelerinin yanındaki sayaçlar. */
export async function countNotificationsByType(
  client: Client,
  userId: string,
): Promise<Map<NotificationType, number>> {
  const { data, error } = await client
    .from('notifications')
    .select('type')
    .eq('user_id', userId)
    .limit(1000)

  if (error) throw new AppError('internal', 'Bildirimler yüklenemedi.')

  const counts = new Map<NotificationType, number>()
  for (const row of data ?? []) {
    if (!isNotificationType(row.type)) continue
    counts.set(row.type, (counts.get(row.type) ?? 0) + 1)
  }
  return counts
}

/**
 * Tek bildirimi okundu işaretler.
 *
 * SAHİPLİK: filtre hem kimliğe hem `user_id`'ye konur. Başkasının bildirim
 * kimliğini gönderen istek hiçbir satıra dokunmaz — RLS zaten engellerdi, ama
 * action bunu kendi başına da garantiler.
 *
 * `read_at` bir kez damgalanır: zaten okunmuş satır tekrar yazılmaz, böylece
 * "ne zaman okundu" bilgisi ikinci tıklamada kaymaz.
 */
export async function markNotificationRead(
  client: Client,
  userId: string,
  notificationId: string,
  now: Date = new Date(),
): Promise<{ updated: boolean; link: string | null }> {
  const { data: existing, error: readError } = await client
    .from('notifications')
    .select('id, link, read_at')
    .eq('id', notificationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (readError) throw new AppError('internal', 'Bildirim okunamadı.')
  if (!existing) throw new AppError('not_found', 'Bildirim bulunamadı.')

  if (existing.read_at !== null) {
    return { updated: false, link: existing.link }
  }

  const { error } = await client
    .from('notifications')
    .update({ read_at: now.toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (error) throw new AppError('internal', 'Bildirim işaretlenemedi.')
  return { updated: true, link: existing.link }
}

/** Kullanıcının tüm okunmamış bildirimlerini işaretler; işaretlenen sayıyı döner. */
export async function markAllNotificationsRead(
  client: Client,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const { data, error } = await client
    .from('notifications')
    .update({ read_at: now.toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id')

  if (error) throw new AppError('internal', 'Bildirimler işaretlenemedi.')
  return (data ?? []).length
}
