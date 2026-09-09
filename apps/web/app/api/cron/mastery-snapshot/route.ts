import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { guardCronRequest } from '@/lib/cron/guard'
import { runJob } from '@/lib/cron/job-run'
import type { DataClient } from '@/lib/data/client'

/**
 * Haftalık yetkinlik fotoğrafı.
 *
 * `topic_mastery`'deki her satırı `mastery_history`'ye kopyalar; gelişim
 * grafiğinin (`getMasteryTimeline`) x ekseni bu satırlardan çıkar. Tabloya
 * yalnızca service-role yazabilir (CONVENTIONS §6), bu yüzden admin istemcisi.
 *
 * Kimlik: `Authorization: Bearer ${CRON_SECRET}` — sabit zamanlı karşılaştırma
 * `lib/cron/guard.ts` içinde.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JOB_NAME = 'mastery_snapshot'

/** Tek okumada çekilecek satır sayısı; bellek sabitlemek için sayfalanır. */
const PAGE_SIZE = 1000

/** Tek insert çağrısındaki satır sayısı. */
const INSERT_CHUNK = 500

export async function POST(request: Request): Promise<Response> {
  const denied = guardCronRequest(request)
  if (denied) return denied

  const admin = createSupabaseAdminClient()

  try {
    const result = await runJob(admin, JOB_NAME, async () => {
      const recordedAt = new Date().toISOString()
      const inserted = await snapshotAll(admin, recordedAt)
      return { affectedRows: inserted, value: { inserted, recordedAt } }
    })

    return Response.json({
      ok: true,
      jobRunId: result.jobRunId,
      inserted: result.affectedRows,
      recordedAt: result.value.recordedAt,
    })
  } catch (error) {
    // Koşum kaydı `runJob` içinde zaten `error` ile kapatıldı; burada yalnızca
    // çağırana (Vercel Cron) başarısızlık bildirilir.
    console.error(`[cron] ${JOB_NAME} başarısız:`, error)
    return Response.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}

/**
 * Tüm yetkinlik satırlarını sayfa sayfa okuyup geçmişe yazar.
 * Tek bir `recorded_at` kullanılır: aynı koşumun satırları aynı ana düşsün,
 * haftalık ortalama koşumun süresine göre iki haftaya bölünmesin.
 */
async function snapshotAll(admin: DataClient, recordedAt: string): Promise<number> {
  let from = 0
  let inserted = 0

  for (;;) {
    const { data, error } = await admin
      .from('topic_mastery')
      .select('user_id, topic_id, mastery')
      // Sayfalama deterministik bir sıra ister; birincil anahtar sırası kullanılır.
      .order('user_id', { ascending: true })
      .order('topic_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`topic_mastery okunamadı: ${error.message}`)

    const rows = data ?? []
    if (rows.length === 0) break

    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK).map((row) => ({
        user_id: row.user_id,
        topic_id: row.topic_id,
        mastery: row.mastery,
        recorded_at: recordedAt,
      }))

      const { error: insertError } = await admin.from('mastery_history').insert(chunk)
      if (insertError) throw new Error(`mastery_history yazılamadı: ${insertError.message}`)
      inserted += chunk.length
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return inserted
}
