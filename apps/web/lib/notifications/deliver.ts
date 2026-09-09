import type { DataClient } from '@/lib/data/client'
import { allowsChannelFor, readNotificationPrefs } from '@/lib/mail/prefs'
import type { NotificationType } from './types'

/**
 * `notifications` TABLOSUNA YAZMANIN TEK KAPISI (spec §M16).
 *
 * ── NEDEN VAR ──────────────────────────────────────────────────────────────
 * Faz 6'da bildirim üreten beş ayrı yer oluştu: iki cron (hatırlatıcı, veli
 * özeti), abonelik uyarısı cron'u, rozet verme ve öğretmen yanıtı. `app_notifications`
 * tercihi bunlardan yalnızca ikisinde denetleniyordu; kalan üçü, ayarlar
 * ekranında "uygulama içi bildirim" anahtarını kapatmış öğrenciye yazmaya
 * devam ediyordu. Kullanıcıya verilmiş bir söz, onu tutan çağıranın sayısı
 * kadar güvenilirdir.
 *
 * Bundan sonra kural tek cümledir: `notifications` tablosuna doğrudan
 * `insert` yazılmaz, bu dosyadan geçilir. Tercih denetimi de tek satırdadır
 * (`allowsChannelFor`), yani ileride kanal semantiği değişirse tek yerde
 * değişir.
 *
 * ── VARSAYILAN AÇIKTIR ─────────────────────────────────────────────────────
 * Profili okunamayan kullanıcı susturulmaz (bkz. lib/mail/prefs.ts): sessizlik,
 * gürültüden daha zor fark edilen bir hatadır.
 *
 * ── ÇAĞIRANI KIRMAZ MI? ────────────────────────────────────────────────────
 * Kırar — bilinçli olarak. Cron'lar bir yazma hatasını `runJob` üzerinden
 * koşum kaydına düşürmek ister. Hatanın yutulması gereken yerlerde (rozet
 * verme, öğretmen yanıtı) çağıran `deliverNotificationsQuietly` kullanır.
 */

export type NotificationDraft = {
  userId: string
  type: NotificationType
  title: string
  body: string
  link: string | null
}

/** Tek yazma çağrısındaki satır sayısı; PostgREST gövdesi şişmesin. */
const INSERT_CHUNK = 500

export type DeliveryResult = {
  /** Gerçekten yazılan satır sayısı. */
  inserted: number
  /** Tercihi kapalı olduğu için hiç yazılmayan satır sayısı. */
  optedOut: number
}

/**
 * Taslakları `app_notifications` tercihine göre süzer ve kalanları yazar.
 *
 * Service-role istemcisi bekler: `notifications` tablosunun INSERT politikası
 * yoktur (0011_rls_policies.sql), satırları yalnızca sistem üretir.
 */
export async function deliverNotifications(
  admin: DataClient,
  drafts: readonly NotificationDraft[],
): Promise<DeliveryResult> {
  if (drafts.length === 0) return { inserted: 0, optedOut: 0 }

  const prefs = await readNotificationPrefs(
    admin,
    drafts.map((draft) => draft.userId),
  )

  const allowed = drafts.filter((draft) =>
    allowsChannelFor(prefs, draft.userId, 'app_notifications'),
  )
  const optedOut = drafts.length - allowed.length
  if (allowed.length === 0) return { inserted: 0, optedOut }

  const rows = allowed.map((draft) => ({
    user_id: draft.userId,
    type: draft.type,
    title: draft.title,
    body: draft.body,
    link: draft.link,
  }))

  let inserted = 0
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const { error } = await admin.from('notifications').insert(chunk)
    if (error) throw new Error(`notifications yazılamadı: ${error.message}`)
    inserted += chunk.length
  }

  return { inserted, optedOut }
}

/**
 * Fırlatmayan sarmalayıcı — bildirim yazılamaması, onu tetikleyen işlemi
 * (kazanılmış rozet, gönderilmiş yanıt) geri almamalı.
 */
export async function deliverNotificationsQuietly(
  admin: DataClient,
  drafts: readonly NotificationDraft[],
): Promise<DeliveryResult> {
  try {
    return await deliverNotifications(admin, drafts)
  } catch (error) {
    console.error('[notifications] bildirim yazılamadı:', error)
    return { inserted: 0, optedOut: 0 }
  }
}
