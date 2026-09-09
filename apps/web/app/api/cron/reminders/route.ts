import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { guardCronRequest } from '@/lib/cron/guard'
import { runJob } from '@/lib/cron/job-run'
import type { DataClient } from '@/lib/data/client'
import { filterByChannel } from '@/lib/mail/prefs'
import { getUserEmails } from '@/lib/mail/recipients'
import { sendEmailBatchQuietly } from '@/lib/mail'
import { reviewReminderEmail } from '@/lib/mail/templates'
import { deliverNotifications, type DeliveryResult } from '@/lib/notifications/deliver'
import { fill, t } from '@/lib/i18n'

/**
 * Tekrar hatırlatıcısı (spec §M9).
 *
 * Vadesi gelmiş kart sayısı eşiği aşan her öğrenciye uygulama içi bir
 * `notifications` satırı yazılır. Bildirim tablosuna yalnızca service-role
 * yazar (0011_rls_policies.sql: öğrenciye yalnızca okuma/işaretleme açıktır),
 * bu yüzden admin istemcisi kullanılır.
 *
 * İKİ KANAL, İKİ TERCİH. Aynı `pending` listesi iki kanaldan geçer ve her
 * kanal KENDİ tercihine bakar: uygulama içi satırı `deliverNotifications`
 * (`app_notifications` denetimini KENDİ içinde yapar), e-postayı ise
 * `email_reminders` açar. İkisini de kapatmış öğrenci hiçbir şey almaz.
 * Tercih denetimi tek yerdedir; gönderenler arasında sapmasın diye burada
 * tekrar yazılmaz.
 *
 * E-posta gönderimi partiyi KIRMAZ: `sendEmailBatchQuietly` her hatayı loglayıp
 * devam eder, `job_runs` yine `success` ile kapanır.
 *
 * Kimlik: `Authorization: Bearer ${CRON_SECRET}` (bkz. lib/cron/guard.ts).
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JOB_NAME = 'review_due_reminders'

/** Bu sayıya ulaşan öğrenci hatırlatılır (spec §M9: "≥ 10 kart"). */
const DUE_THRESHOLD = 10

/** Tek okumada çekilecek satır sayısı; bellek sabitlemek için sayfalanır. */
const PAGE_SIZE = 1000

/** Aynı kullanıcıya bu kadar saat içinde ikinci hatırlatma yazılmaz. */
const COOLDOWN_HOURS = 20

export async function POST(request: Request): Promise<Response> {
  const denied = guardCronRequest(request)
  if (denied) return denied

  const admin = createSupabaseAdminClient()

  try {
    const result = await runJob(admin, JOB_NAME, async () => {
      const now = new Date()
      const dueByUser = await countDueCardsByUser(admin, now)

      const eligible = [...dueByUser.entries()]
        .filter(([, count]) => count >= DUE_THRESHOLD)
        .map(([userId, count]) => ({ userId, count }))

      const alreadyNotified = await findRecentlyNotified(
        admin,
        eligible.map((entry) => entry.userId),
        now,
      )
      const pending = eligible.filter((entry) => !alreadyNotified.has(entry.userId))
      const pendingIds = pending.map((entry) => entry.userId)

      // E-posta kanalının tercihi burada; uygulama içi kanalın tercihi
      // `deliverNotifications`ın kendi içinde. İkisi birbirinden bağımsız.
      const mailAllowed = new Set(await filterByChannel(admin, pendingIds, 'email_reminders'))

      const delivery = await insertReminders(admin, pending)
      const inserted = delivery.inserted

      const mailed = await sendReminderEmails(
        admin,
        pending.filter((entry) => mailAllowed.has(entry.userId)),
      )

      return {
        affectedRows: inserted,
        metadata: {
          eligible: eligible.length,
          skipped: eligible.length - pending.length,
          appOptedOut: delivery.optedOut,
          mailed,
          mailOptedOut: pending.length - mailAllowed.size,
        },
        value: { inserted, eligible: eligible.length, mailed },
      }
    })

    return Response.json({
      ok: true,
      jobRunId: result.jobRunId,
      notified: result.affectedRows,
      mailed: result.value.mailed,
      eligible: result.value.eligible,
    })
  } catch (error) {
    // Koşum kaydı `runJob` içinde `error` ile kapatıldı; burada yalnızca
    // çağırana (Vercel Cron) başarısızlık bildirilir.
    console.error(`[cron] ${JOB_NAME} başarısız:`, error)
    return Response.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}

/**
 * Kullanıcı başına vadesi gelmiş kart sayısı.
 *
 * Postgres tarafında `group by` yapılamıyor (PostgREST toplama yüzeyi açık
 * değil), bu yüzden satırlar sayfa sayfa okunup bellekte sayılır. Sayfalama
 * birincil anahtar sırasıyla yapılır: aynı satır iki kez okunmaz.
 */
async function countDueCardsByUser(admin: DataClient, now: Date): Promise<Map<string, number>> {
  const nowIso = now.toISOString()
  const counts = new Map<string, number>()
  let from = 0

  for (;;) {
    const { data, error } = await admin
      .from('card_reviews')
      .select('user_id, flashcard_id')
      .lte('next_review_at', nowIso)
      .order('user_id', { ascending: true })
      .order('flashcard_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`card_reviews okunamadı: ${error.message}`)

    const rows = data ?? []
    for (const row of rows) {
      counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return counts
}

/**
 * Son `COOLDOWN_HOURS` saatte zaten hatırlatılmış kullanıcılar.
 * İş günde birden çok kez koşsa da öğrenci aynı hatırlatmayı iki kez almaz.
 */
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
      .eq('type', 'review_due')
      .gte('created_at', since)
      .in('user_id', [...chunk])

    if (error) throw new Error(`notifications okunamadı: ${error.message}`)
    for (const row of data ?? []) notified.add(row.user_id)
  }

  return notified
}

/**
 * Bildirim satırlarını tek kapıdan yazar (`lib/notifications/deliver.ts`):
 * uygulama içi bildirimi kapatmış öğrenciye satır yazılmaz, sayfalama ve
 * tercih denetimi orada yaşar. Kullanıcıya görünen metin sözlükten gelir.
 */
async function insertReminders(
  admin: DataClient,
  entries: ReadonlyArray<{ userId: string; count: number }>,
): Promise<DeliveryResult> {
  return deliverNotifications(
    admin,
    entries.map((entry) => ({
      userId: entry.userId,
      type: 'review_due' as const,
      title: t('notifications.messages.reviewDueTitle'),
      body: fill(t('notifications.messages.reviewDueBody'), { count: entry.count }),
      link: '/kartlar',
    })),
  )
}

/**
 * Tekrar hatırlatma e-postası.
 *
 * Adresi okunamayan alıcı sessizce atlanır (`getUserEmails` fırlatmaz) ve
 * gönderim hatası partiyi durdurmaz — e-posta, işin sonucu değil yan etkisidir.
 * Kart sayısı SUNUCUDA sayıldı; istemciden gelen hiçbir değer kullanılmaz.
 */
async function sendReminderEmails(
  admin: DataClient,
  entries: ReadonlyArray<{ userId: string; count: number }>,
): Promise<number> {
  if (entries.length === 0) return 0

  const emails = await getUserEmails(
    admin,
    entries.map((entry) => entry.userId),
  )

  const messages = entries.flatMap((entry) => {
    const to = emails.get(entry.userId)
    if (!to) return []
    const rendered = reviewReminderEmail({ dueCount: entry.count })
    return [{ to, subject: rendered.subject, html: rendered.html, text: rendered.text }]
  })

  return sendEmailBatchQuietly(messages)
}
