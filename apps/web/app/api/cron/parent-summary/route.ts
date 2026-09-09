import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { guardCronRequest } from '@/lib/cron/guard'
import { runJob } from '@/lib/cron/job-run'
import type { DataClient } from '@/lib/data/client'
import { getWeeklySummary, type ParentWeeklySummary } from '@/lib/data/parent'
import { parentStrings } from '@/components/parent/strings'
import { studentHref } from '@/lib/parent/select'
import { previousWeekStart, weekRangeLabel } from '@/lib/parent/week'
import { weekStartOf } from '@/lib/plan/week'
import { fill } from '@/lib/i18n'
import type { EmailMessage } from '@/lib/mail'
import { filterByChannel } from '@/lib/mail/prefs'
import { getUserEmails } from '@/lib/mail/recipients'
import { sendEmailBatchQuietly } from '@/lib/mail'
import { parentWeeklySummaryEmail } from '@/lib/mail/templates'
import { deliverNotifications, type NotificationDraft } from '@/lib/notifications/deliver'

/**
 * Veliye haftalık özet bildirimi (spec §M12).
 *
 * Pazartesi 08:00 TSİ'de çalışır ve BİTEN haftayı özetler. Her aktif
 * `parent_links` satırı için bir `notifications` satırı yazılır; tabloya
 * yalnızca service-role yazabildiği için admin istemcisi kullanılır
 * (CONVENTIONS §4).
 *
 * ── İKİ KANAL, İKİ TERCİH (Faz 6 — tamamlandı) ─────────────────────────────
 * Özet artık hem uygulama içinde hem e-postayla gider ve her kanal KENDİ
 * tercihine bakar (`lib/mail/prefs.ts`): `app_notifications` bildirim satırını,
 * `email_weekly_summary` e-postayı açar. Faz 5'te tek kanal olduğu için
 * uygulama içi satır da `email_weekly_summary` ile kapatılıyordu; kanal
 * eklendiğine göre doğru eşleme budur — "e-posta istemiyorum ama panelde
 * görüneyim" diyen veli artık bunu söyleyebiliyor.
 *
 * E-posta gönderimi partiyi KIRMAZ: `sendEmailBatchQuietly` hatayı loglayıp
 * devam eder; `job_runs` yine `success` ile kapanır ve `affectedRows` uygulama
 * içi satır sayısını saymaya devam eder.
 *
 * ── TEK VELİNİN HATASI TÜM PARTİYİ DÜŞÜRMEZ ────────────────────────────────
 * Özet üretimi veli-öğrenci çifti başına ayrı bir `try` içindedir. Bir
 * öğrencinin verisi okunamazsa o çift atlanır, sayaç `failed` olarak
 * ilerler; koşum yine `success` ile kapanır ve diğer veliler bildirimini alır.
 *
 * Kimlik: `Authorization: Bearer ${CRON_SECRET}` (bkz. lib/cron/guard.ts).
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JOB_NAME = 'parent_weekly_summary'

/** Tek okumada çekilecek satır sayısı; bellek sabitlemek için sayfalanır. */
const PAGE_SIZE = 1000

export async function POST(request: Request): Promise<Response> {
  const denied = guardCronRequest(request)
  if (denied) return denied

  const admin = createSupabaseAdminClient()

  try {
    const result = await runJob(admin, JOB_NAME, async () => {
      const now = new Date()
      // Özet BİTEN haftaya aittir: Pazartesi sabahı "bu hafta" henüz boştur.
      const weekStart = previousWeekStart(weekStartOf(now))

      const pairs = await readActiveLinks(admin)
      const alreadySent = await readAlreadyNotified(admin, weekStart)
      const pending = pairs.filter((pair) => !alreadySent.has(pair.parentId))
      const parentIds = pending.map((pair) => pair.parentId)

      // Kanal başına tercih; ikisi birbirinden bağımsız (lib/mail/prefs.ts).
      const appAllowed = new Set(await filterByChannel(admin, parentIds, 'app_notifications'))
      const mailAllowed = new Set(await filterByChannel(admin, parentIds, 'email_weekly_summary'))

      const names = await readStudentNames(
        admin,
        pending.map((pair) => pair.studentId),
      )
      // Adres okuması yalnızca e-postası açık olan veliler için yapılır.
      const emails = await getUserEmails(
        admin,
        pending.filter((pair) => mailAllowed.has(pair.parentId)).map((pair) => pair.parentId),
      )

      const rows: NotificationRow[] = []
      const messages: EmailMessage[] = []
      let failed = 0

      for (const pair of pending) {
        const wantsApp = appAllowed.has(pair.parentId)
        const wantsMail = mailAllowed.has(pair.parentId)
        if (!wantsApp && !wantsMail) continue

        try {
          const summary = await getWeeklySummary(admin, pair.studentId, weekStart)
          const studentName = names.get(pair.studentId) ?? null

          if (wantsApp) {
            rows.push(buildNotification(pair, studentName, weekStart, summary))
          }

          const to = wantsMail ? emails.get(pair.parentId) : undefined
          if (to) {
            const rendered = parentWeeklySummaryEmail({
              studentName,
              weekLabel: weekRangeLabel(weekStart),
              studyMinutes: summary.studyMinutes,
              questionsAnswered: summary.questionsAnswered,
              videosCompleted: summary.videosCompleted,
              accuracyPercent: summary.accuracyPercent,
              reportPath: studentHref('/veli/raporlar', pair.studentId, weekStart),
            })
            messages.push({
              to,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
            })
          }
        } catch (error) {
          // Bir velinin özeti çıkmadı diye parti durmaz; kayıt düşülür, devam.
          failed += 1
          console.error(`[cron] ${JOB_NAME}: ${pair.parentId} için özet üretilemedi:`, error)
        }
      }

      const inserted = await insertNotifications(admin, rows)
      const mailed = await sendEmailBatchQuietly(messages)

      return {
        affectedRows: inserted,
        metadata: {
          weekStart,
          links: pairs.length,
          skipped: pairs.length - pending.length,
          appOptedOut: pending.length - appAllowed.size,
          mailOptedOut: pending.length - mailAllowed.size,
          mailed,
          failed,
        },
        value: { inserted, weekStart, failed, mailed },
      }
    })

    return Response.json({
      ok: true,
      jobRunId: result.jobRunId,
      notified: result.affectedRows,
      mailed: result.value.mailed,
      weekStart: result.value.weekStart,
      failed: result.value.failed,
    })
  } catch (error) {
    // Koşum kaydı `runJob` içinde `error` ile kapatıldı; burada yalnızca
    // çağırana (Vercel Cron) başarısızlık bildirilir.
    console.error(`[cron] ${JOB_NAME} başarısız:`, error)
    return Response.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}

/* ------------------------------------------------------------------------- *
 * Yardımcılar
 * ------------------------------------------------------------------------- */

type LinkPair = { parentId: string; studentId: string }

type NotificationRow = NotificationDraft & { type: 'weekly_summary' }

/** Aktif veli-öğrenci çiftleri, sayfa sayfa. */
async function readActiveLinks(admin: DataClient): Promise<LinkPair[]> {
  const pairs: LinkPair[] = []
  let from = 0

  for (;;) {
    const { data, error } = await admin
      .from('parent_links')
      .select('parent_id, student_id')
      .eq('status', 'active')
      .order('parent_id', { ascending: true })
      .order('student_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`parent_links okunamadı: ${error.message}`)

    const rows = data ?? []
    for (const row of rows) {
      pairs.push({ parentId: row.parent_id, studentId: row.student_id })
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return pairs
}

/**
 * Bu haftanın özetini zaten almış veliler.
 * İş elle ikinci kez tetiklenirse aynı veliye iki bildirim gitmesin.
 */
async function readAlreadyNotified(admin: DataClient, weekStart: string): Promise<Set<string>> {
  const since = `${weekStart}T00:00:00+03:00`
  const notified = new Set<string>()
  let from = 0

  for (;;) {
    const { data, error } = await admin
      .from('notifications')
      .select('user_id, created_at')
      .eq('type', 'weekly_summary')
      // Özet biten haftaya ait; o haftanın başından beri yazılmış her satır
      // aynı raporun kendisidir.
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`notifications okunamadı: ${error.message}`)

    const rows = data ?? []
    for (const row of rows) notified.add(row.user_id)

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return notified
}

/** Bildirim metninde kullanılacak öğrenci adları. */
async function readStudentNames(
  admin: DataClient,
  studentIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(studentIds)]
  const names = new Map<string, string>()
  if (ids.length === 0) return names

  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const chunk = ids.slice(i, i + PAGE_SIZE)
    const { data, error } = await admin
      .from('profiles')
      .select('id, full_name, display_name')
      .in('id', chunk)

    if (error) throw new Error(`profiles okunamadı: ${error.message}`)

    for (const row of data ?? []) {
      const name = row.display_name?.trim() || row.full_name?.trim()
      if (name) names.set(row.id, name)
    }
  }

  return names
}

/** Kullanıcıya görünen metin Türkçedir ve sözlükten gelir. */
function buildNotification(
  pair: LinkPair,
  studentName: string | null,
  weekStart: string,
  summary: ParentWeeklySummary,
): NotificationRow {
  const s = parentStrings()

  return {
    userId: pair.parentId,
    type: 'weekly_summary',
    title: fill(s.notification.title, {
      name: studentName ?? s.notification.studentFallback,
    }),
    body: fill(s.notification.body, {
      week: weekRangeLabel(weekStart),
      minutes: summary.studyMinutes,
      questions: summary.questionsAnswered,
      videos: summary.videosCompleted,
      accuracy:
        summary.accuracyPercent === null
          ? s.notification.accuracyUnknown
          : `%${summary.accuracyPercent}`,
    }),
    // Bağlantı seçili öğrenciyi de taşır: iki öğrencisi olan veli doğru
    // rapora düşsün, ilk öğrenciye değil.
    link: studentHref('/veli/raporlar', pair.studentId, weekStart),
  }
}

/**
 * Yazma tek kapıdan geçer (`lib/notifications/deliver.ts`); tercih denetimi ve
 * parçalama orada. Yukarıdaki `appAllowed` süzgeci yalnızca gereksiz özet
 * hesabından kaçınmak içindir, kapının yerini almaz.
 */
async function insertNotifications(admin: DataClient, rows: NotificationRow[]): Promise<number> {
  const { inserted } = await deliverNotifications(admin, rows)
  return inserted
}
