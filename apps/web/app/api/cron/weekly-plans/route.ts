import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { guardCronRequest } from '@/lib/cron/guard'
import { runJob } from '@/lib/cron/job-run'
import { generatePlanForUser } from '@/lib/plan/generate'
import { weekStartOf } from '@/lib/plan/week'
import type { DataClient } from '@/lib/data/client'

/**
 * Haftalık çalışma programı üretimi (spec §M8) — Pazar 03:00 TR.
 *
 * BİR KULLANICININ HATASI KOŞUMU DURDURMAZ. Her kullanıcı kendi try/catch'i
 * içinde işlenir; hatalar toplanıp `job_runs.metadata` altına yazılır. Aksi
 * hâlde tek bozuk profil (silinmiş sınav, tutarsız müfredat) o hafta hiç
 * kimsenin programının üretilmemesine yol açardı.
 *
 * Kimlik: `Authorization: Bearer ${CRON_SECRET}` — sabit zamanlı karşılaştırma
 * `lib/cron/guard.ts` içinde.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JOB_NAME = 'weekly_plans'

/** Tek okumada çekilecek öğrenci sayısı. */
const PAGE_SIZE = 200

/** Aynı anda kaç kullanıcı için üretim yapılacağı. */
const CONCURRENCY = 5

/** `job_runs.metadata` şişmesin diye kaydedilen en fazla hata. */
const MAX_RECORDED_ERRORS = 20

type Summary = {
  processed: number
  generated: number
  skipped: number
  failed: number
  errors: Array<{ userId: string; message: string }>
}

export async function POST(request: Request): Promise<Response> {
  const denied = guardCronRequest(request)
  if (denied) return denied

  const admin = createSupabaseAdminClient()
  // Hedef hafta bir kez hesaplanır: koşum gece yarısını geçse bile bütün
  // kullanıcılar AYNI haftanın planını alır.
  const weekStart = weekStartOf(new Date())

  try {
    const result = await runJob(
      admin,
      JOB_NAME,
      async () => {
        const summary = await generateForAllStudents(admin, weekStart)
        return {
          affectedRows: summary.generated,
          metadata: {
            weekStart,
            processed: summary.processed,
            generated: summary.generated,
            skipped: summary.skipped,
            failed: summary.failed,
            errors: summary.errors.map((entry) => `${entry.userId}: ${entry.message}`),
          },
          value: summary,
        }
      },
      { weekStart },
    )

    return Response.json({
      ok: true,
      jobRunId: result.jobRunId,
      weekStart,
      processed: result.value.processed,
      generated: result.value.generated,
      skipped: result.value.skipped,
      failed: result.value.failed,
    })
  } catch (error) {
    // Koşum kaydı `runJob` içinde `error` ile kapatıldı; burada yalnızca
    // çağırana başarısızlık bildirilir.
    console.error(`[cron] ${JOB_NAME} başarısız:`, error)
    return Response.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}

/**
 * Program üretilecek öğrenciler: onboarding'i bitirmiş ve bir sınav seçmiş
 * olanlar. Sınavsız profil `generatePlanForUser` içinde de atlanır; buradaki
 * süzgeç yalnızca boşuna sorgu yapılmasını önler.
 */
async function generateForAllStudents(admin: DataClient, weekStart: string): Promise<Summary> {
  const summary: Summary = { processed: 0, generated: 0, skipped: 0, failed: 0, errors: [] }
  let from = 0

  for (;;) {
    const { data, error } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'student')
      .eq('onboarding_completed', true)
      .not('exam_id', 'is', null)
      // Sayfalama deterministik bir sıra ister; birincil anahtar kullanılır.
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`profiller okunamadı: ${error.message}`)

    const rows = data ?? []
    if (rows.length === 0) break

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map((row) => generateOne(admin, row.id, weekStart, summary)))
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return summary
}

async function generateOne(
  admin: DataClient,
  userId: string,
  weekStart: string,
  summary: Summary,
): Promise<void> {
  summary.processed += 1
  try {
    const outcome = await generatePlanForUser(admin, userId, undefined, { weekStart })
    if (outcome.status === 'generated') summary.generated += 1
    else summary.skipped += 1
  } catch (error) {
    summary.failed += 1
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[cron] ${JOB_NAME}: ${userId} için program üretilemedi:`, error)
    if (summary.errors.length < MAX_RECORDED_ERRORS) {
      summary.errors.push({ userId, message })
    }
  }
}
