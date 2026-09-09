import type { DataClient } from '@/lib/data/client'
import {
  DEFAULT_NOTIFICATION_PREFS,
  parseNotificationPrefs,
  type NotificationPrefs,
} from '@/app/(student)/ayarlar/schemas'

/**
 * BİLDİRİM TERCİHİ KAPISI — tek kaynak (spec §M16).
 *
 * Her gönderen (cron, action, webhook) bu dosyadan geçer. Sebebi basit: tercih
 * denetimi iki yerde ayrı yazılırsa er ya da geç biri güncellenir, diğeri
 * unutulur ve kapattığını sanan kullanıcıya e-posta gitmeye devam eder.
 *
 * ── VARSAYILAN AÇIKTIR, EKSİK ANAHTAR KAPATMAZ ─────────────────────────────
 * `profiles.notification_prefs` üç anahtarla doluyor (0002_identity.sql) ama
 * elle yazılmış ya da eski bir satır eksik olabilir. Yalnızca AÇIKÇA `false`
 * yazılmış olması kapatır; bilinmeyen değer varsayılana (açık) düşer.
 *
 * ── KANALLAR BAĞIMSIZDIR ───────────────────────────────────────────────────
 * `app_notifications` uygulama içi satırı, `email_reminders` ve
 * `email_weekly_summary` ilgili e-postayı yönetir. Biri kapalı diye diğeri
 * kapanmaz; kullanıcı "e-posta istemiyorum ama zilde görsün" diyebilmelidir.
 */

export type NotificationChannel = keyof NotificationPrefs

export const NOTIFICATION_CHANNELS = [
  'email_reminders',
  'email_weekly_summary',
  'app_notifications',
] as const satisfies readonly NotificationChannel[]

export { DEFAULT_NOTIFICATION_PREFS, parseNotificationPrefs }
export type { NotificationPrefs }

/** Ham jsonb değerine bakarak tek bir kanalın açık olup olmadığını söyler. */
export function allowsChannel(prefs: unknown, channel: NotificationChannel): boolean {
  return parseNotificationPrefs(prefs)[channel]
}

/** Tek okumada çekilecek profil sayısı. */
const CHUNK = 1000

/**
 * Verilen kullanıcıların tercihlerini okur.
 *
 * Profili okunamayan kullanıcı haritada YER ALMAZ; çağıran taraf onu
 * `allowsChannelFor` üzerinden varsayılan (açık) kabul eder. Okuma hatası bir
 * kullanıcıyı sessizce susturmamalı — sessizlik, gürültüden daha zor fark
 * edilen bir hatadır.
 */
export async function readNotificationPrefs(
  client: DataClient,
  userIds: readonly string[],
): Promise<Map<string, NotificationPrefs>> {
  const ids = [...new Set(userIds)]
  const byUser = new Map<string, NotificationPrefs>()
  if (ids.length === 0) return byUser

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data, error } = await client
      .from('profiles')
      .select('id, notification_prefs')
      .in('id', chunk)

    if (error) throw new Error(`profiles.notification_prefs okunamadı: ${error.message}`)

    for (const row of data ?? []) {
      byUser.set(row.id, parseNotificationPrefs(row.notification_prefs))
    }
  }

  return byUser
}

/** Haritada olmayan kullanıcı varsayılana düşer (kanal açık). */
export function allowsChannelFor(
  prefs: ReadonlyMap<string, NotificationPrefs>,
  userId: string,
  channel: NotificationChannel,
): boolean {
  return (prefs.get(userId) ?? DEFAULT_NOTIFICATION_PREFS)[channel]
}

/**
 * Kanalı açık bırakmış kullanıcı kimlikleri — gönderenlerin kullandığı asıl
 * yardımcı. Sıra korunur, tekrarlar ayıklanmaz (çağıranın listesi neyse odur).
 */
export async function filterByChannel(
  client: DataClient,
  userIds: readonly string[],
  channel: NotificationChannel,
): Promise<string[]> {
  const prefs = await readNotificationPrefs(client, userIds)
  return userIds.filter((id) => allowsChannelFor(prefs, id, channel))
}
