import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { guardCronRequest } from '@/lib/cron/guard'
import { runJob } from '@/lib/cron/job-run'
import type { DataClient } from '@/lib/data/client'
import { daysUntil, warningWindow, SUBSCRIPTION_WARNING_DAYS } from '@/lib/billing/period'
import { fill, t } from '@/lib/i18n'
import { deliverNotifications } from '@/lib/notifications/deliver'
import { filterByChannel } from '@/lib/mail/prefs'
import { getUserEmails } from '@/lib/mail/recipients'
import { sendEmailBatchQuietly } from '@/lib/mail'
import { subscriptionEndingEmail } from '@/lib/mail/templates'

/**
 * Abonelik bitiş uyarısı ve süresi dolmuş aboneliklerin kapatılması
 * (spec §M14).
 *
 * İki iş bir arada, çünkü ikisi de aynı satır kümesine bakar:
 *   1. Bitişine 7 günden az kalan AKTİF abonelikler için `subscription_ending`
 *      bildirimi yazılır.
 *   2. Bitişi geçmiş AKTİF abonelikler `expired` işaretlenir.
 * Sıra önemli: önce uyarı, sonra kapatma. Ters sırada, bugün bitecek bir
 * abonelik uyarı almadan kapanırdı.
 *
 * `notifications` ve `subscriptions` tablolarına yalnızca service-role yazar
 * (0011_rls_policies.sql), bu yüzden admin istemcisi kullanılır.
 *
 * ── İKİ KANAL, İKİ TERCİH ──────────────────────────────────────────────────
 * Uygulama içi satır `deliverNotifications` üzerinden yazılır ve
 * `app_notifications` tercihini KENDİ içinde denetler; e-posta ise
 * `email_reminders` kanalına bağlıdır. Abonelik uyarısı ticari bir duyuru
 * değil, kullanıcının kendi hesabına dair bir hatırlatmadır; ayarlar
 * ekranındaki üç anahtardan anlamca en yakın olanı budur ve kullanıcıya
 * verilen söz tutulur: kapatan e-posta almaz.
 *
 * Kimlik: `Authorization: Bearer ${CRON_SECRET}` (bkz. lib/cron/guard.ts).
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JOB_NAME = 'subscription_warnings'

/** Tek okumada çekilecek satır sayısı. */
const PAGE_SIZE = 1000

/** Aynı aboneliğe bu kadar saat içinde ikinci uyarı yazılmaz. */
const COOLDOWN_HOURS = 20

export async function POST(request: Request): Promise<Response> {
  const denied = guardCronRequest(request)
  if (denied) return denied

  const admin = createSupabaseAdminClient()

  try {
    const result = await runJob(admin, JOB_NAME, async () => {
      const now = new Date()

      const warned = await warnEndingSoon(admin, now)
      const expired = await expirePastDue(admin, now)

      return {
        affectedRows: warned + expired,
        metadata: { warned, expired, windowDays: SUBSCRIPTION_WARNING_DAYS },
        value: { warned, expired },
      }
    })

    return Response.json({
      ok: true,
      jobRunId: result.jobRunId,
      warned: result.value.warned,
      expired: result.value.expired,
    })
  } catch (error) {
    console.error(`[cron] ${JOB_NAME} başarısız:`, error)
    return Response.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}

/* ------------------------------------------------------------------------- *
 * 1. Bitişi yaklaşan abonelikler
 * ------------------------------------------------------------------------- */

async function warnEndingSoon(admin: DataClient, now: Date): Promise<number> {
  const { fromIso, toIso } = warningWindow(now, SUBSCRIPTION_WARNING_DAYS)

  // Pencere (şimdi, şimdi + 7 gün]: hâlâ geçerli ama yakında bitecek olanlar.
  // Zaten bitmiş olan uyarı almaz, aşağıda `expired` işaretlenir.
  const rows: Array<{ userId: string; endsAt: string; packageId: string | null }> = []
  let from = 0

  for (;;) {
    const { data, error } = await admin
      .from('subscriptions')
      .select('id, user_id, ends_at, package_id')
      .eq('status', 'active')
      .gt('ends_at', fromIso)
      .lte('ends_at', toIso)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`subscriptions okunamadı: ${error.message}`)

    const page = data ?? []
    for (const row of page) {
      rows.push({ userId: row.user_id, endsAt: row.ends_at, packageId: row.package_id })
    }

    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  if (rows.length === 0) return 0

  const recentlyNotified = await findRecentlyNotified(
    admin,
    rows.map((row) => row.userId),
    now,
  )

  const pending = rows.filter((row) => !recentlyNotified.has(row.userId))
  if (pending.length === 0) return 0

  // ① Uygulama içi bildirim — tercih denetimi `deliverNotifications` içinde.
  const { inserted } = await deliverNotifications(
    admin,
    pending.map((row) => {
      const remaining = Math.max(0, daysUntil(row.endsAt, now))
      return {
        userId: row.userId,
        type: 'subscription_ending' as const,
        title: t('billing.subscriptionEndingTitle'),
        body:
          remaining === 0
            ? t('billing.subscriptionEndingBodyToday')
            : fill(t('billing.subscriptionEndingBodyDays'), { days: remaining }),
        link: '/paketler',
      }
    }),
  )

  // ② E-posta — ayrı tercih, ayrı hata sınırı. Gönderim partiyi KIRMAZ.
  await mailEndingSoon(admin, pending, now)

  return inserted
}

/**
 * Bitiş uyarısı e-postası.
 *
 * Adresi okunamayan alıcı sessizce atlanır, gönderim hatası partiyi durdurmaz
 * (`sendEmailBatchQuietly`) — e-posta işin sonucu değil, yan etkisidir. Paket
 * adı ve kalan gün SUNUCUDA okunur; e-postaya hiçbir sır ya da başka
 * kullanıcının verisi girmez.
 */
async function mailEndingSoon(
  admin: DataClient,
  pending: ReadonlyArray<{ userId: string; endsAt: string; packageId: string | null }>,
  now: Date,
): Promise<number> {
  const allowed = new Set(
    await filterByChannel(
      admin,
      pending.map((row) => row.userId),
      'email_reminders',
    ),
  )

  const targets = pending.filter((row) => allowed.has(row.userId))
  if (targets.length === 0) return 0

  const [emails, packageNames, names] = await Promise.all([
    getUserEmails(
      admin,
      targets.map((row) => row.userId),
    ),
    readPackageNames(
      admin,
      targets.map((row) => row.packageId),
    ),
    readDisplayNames(
      admin,
      targets.map((row) => row.userId),
    ),
  ])

  const messages = targets.flatMap((row) => {
    const to = emails.get(row.userId)
    if (!to) return []

    const rendered = subscriptionEndingEmail({
      name: names.get(row.userId) ?? null,
      packageName:
        (row.packageId ? packageNames.get(row.packageId) : null) ??
        t('billing.mailPackageFallback'),
      daysLeft: Math.max(0, daysUntil(row.endsAt, now)),
      endsAtLabel: endsAtLabel(row.endsAt),
    })

    return [{ to, subject: rendered.subject, html: rendered.html, text: rendered.text }]
  })

  return sendEmailBatchQuietly(messages)
}

/** Paket adları; okunamayan paket e-postada yedek etikete düşer. */
async function readPackageNames(
  admin: DataClient,
  packageIds: ReadonlyArray<string | null>,
): Promise<Map<string, string>> {
  const ids = [...new Set(packageIds.filter((id): id is string => id !== null))]
  const names = new Map<string, string>()
  if (ids.length === 0) return names

  const { data, error } = await admin.from('packages').select('id, name').in('id', ids)
  if (error) throw new Error(`packages okunamadı: ${error.message}`)

  for (const row of data ?? []) names.set(row.id, row.name)
  return names
}

/**
 * Hitap için ad. `display_name` önce gelir; kullanıcı kendi seçtiği adla
 * anılsın. İkisi de boşsa hitap adsız kurulur (`greeting` bunu bilir).
 */
async function readDisplayNames(
  admin: DataClient,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)]
  const names = new Map<string, string>()
  if (ids.length === 0) return names

  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const chunk = ids.slice(i, i + PAGE_SIZE)
    const { data, error } = await admin
      .from('profiles')
      .select('id, display_name, full_name')
      .in('id', chunk)

    if (error) throw new Error(`profiles okunamadı: ${error.message}`)

    for (const row of data ?? []) {
      const name = row.display_name?.trim() || row.full_name?.trim()
      if (name) names.set(row.id, name)
    }
  }

  return names
}

/** "16 Eylül 2026" — e-posta gövdesindeki tarih etiketi. */
function endsAtLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date)
}

/** Son `COOLDOWN_HOURS` saatte zaten uyarılmış kullanıcılar. */
async function findRecentlyNotified(
  admin: DataClient,
  userIds: readonly string[],
  now: Date,
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()

  const since = new Date(now.getTime() - COOLDOWN_HOURS * 3_600_000).toISOString()
  const notified = new Set<string>()

  for (let i = 0; i < userIds.length; i += PAGE_SIZE) {
    const chunk = userIds.slice(i, i + PAGE_SIZE)
    const { data, error } = await admin
      .from('notifications')
      .select('user_id')
      .eq('type', 'subscription_ending')
      .gte('created_at', since)
      .in('user_id', [...chunk])

    if (error) throw new Error(`notifications okunamadı: ${error.message}`)
    for (const row of data ?? []) notified.add(row.user_id)
  }

  return notified
}

/* ------------------------------------------------------------------------- *
 * 2. Süresi dolmuş abonelikler
 * ------------------------------------------------------------------------- */

/**
 * Bitişi geçmiş aktif abonelikleri `expired` yapar.
 *
 * Erişim kararı zaten `ends_at` üzerinden veriliyor
 * (`public.has_active_subscription`), yani bu güncelleme kimseye fazladan
 * erişim vermez ya da almaz — durumu gerçekle hizalar ve raporları düzeltir.
 */
async function expirePastDue(admin: DataClient, now: Date): Promise<number> {
  const { data, error } = await admin
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lte('ends_at', now.toISOString())
    .select('id')

  if (error) throw new Error(`subscriptions güncellenemedi: ${error.message}`)
  return (data ?? []).length
}
