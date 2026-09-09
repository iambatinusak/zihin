import 'server-only'

import type { Json } from '@zihin/db/types'
import type { DataClient } from '@/lib/data/client'

/**
 * `job_runs` denetim kaydı — zamanlanmış işlerin gözlemlenebilirliğinin tek
 * kaynağı (0001_foundation.sql).
 *
 * `job_runs` yalnızca service-role tarafından yazılabilir; buradaki her
 * fonksiyon `createSupabaseAdminClient()` istemcisi bekler.
 *
 * Tipik kullanım — `runJob` her şeyi kendisi kapatır:
 *
 *   const result = await runJob(admin, 'mastery_snapshot', async () => {
 *     const rows = await doWork()
 *     return { affectedRows: rows, metadata: { users: 12 } }
 *   })
 *
 * `runJob` hatayı YUTMAZ: kaydı `error` ile kapatır ve hatayı yeniden fırlatır.
 * Rota hatayı 500'e çevirmekte serbesttir, ama kayıt her hâlükârda kapanır.
 */

export type JobStatus = 'running' | 'success' | 'error'

export type JobRunHandle = {
  /** Satır açılamadıysa null — iş yine de çalışır, sadece kaydı tutulamaz. */
  id: string | null
  jobName: string
  startedAt: string
}

export type JobOutcome = {
  affectedRows?: number
  metadata?: Record<string, Json>
}

/** Koşum kaydını `running` durumuyla açar. */
export async function startJobRun(
  admin: DataClient,
  jobName: string,
  metadata: Record<string, Json> = {},
): Promise<JobRunHandle> {
  const startedAt = new Date().toISOString()

  const { data, error } = await admin
    .from('job_runs')
    .insert({ job_name: jobName, started_at: startedAt, status: 'running', metadata })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    // Denetim kaydı açılamadı diye iş iptal edilmez; iş kaydından daha önemlidir.
    console.error(`[cron] ${jobName}: job_runs kaydı açılamadı:`, error)
    return { id: null, jobName, startedAt }
  }

  return { id: data.id, jobName, startedAt }
}

/** Koşum kaydını kapatır. Kayıt açılamamışsa sessizce geçer. */
export async function finishJobRun(
  admin: DataClient,
  handle: JobRunHandle,
  outcome: { status: Exclude<JobStatus, 'running'> } & JobOutcome & { errorMessage?: string },
): Promise<void> {
  if (handle.id === null) return

  const { error } = await admin
    .from('job_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: outcome.status,
      affected_rows: outcome.affectedRows ?? null,
      error_message: outcome.errorMessage ?? null,
      ...(outcome.metadata ? { metadata: outcome.metadata } : {}),
    })
    .eq('id', handle.id)

  if (error) {
    console.error(`[cron] ${handle.jobName}: job_runs kaydı kapatılamadı:`, error)
  }
}

export type JobRunResult<T> = {
  jobRunId: string | null
  affectedRows: number
  value: T
}

/**
 * Bir işi `job_runs` kaydıyla sarmalar: başlarken açar, bitince kapatır,
 * hata hâlinde `error` yazıp hatayı yeniden fırlatır.
 */
export async function runJob<T>(
  admin: DataClient,
  jobName: string,
  handler: (handle: JobRunHandle) => Promise<JobOutcome & { value: T }>,
  startMetadata: Record<string, Json> = {},
): Promise<JobRunResult<T>> {
  const handle = await startJobRun(admin, jobName, startMetadata)

  try {
    const outcome = await handler(handle)
    const affectedRows = outcome.affectedRows ?? 0
    await finishJobRun(admin, handle, {
      status: 'success',
      affectedRows,
      ...(outcome.metadata ? { metadata: outcome.metadata } : {}),
    })
    return { jobRunId: handle.id, affectedRows, value: outcome.value }
  } catch (error) {
    await finishJobRun(admin, handle, {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
