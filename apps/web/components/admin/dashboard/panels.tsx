import type { ReactNode } from 'react'
import { Badge } from '@zihin/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@zihin/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import { EmptyState } from '@/components/common/empty-state'
import { fill, t } from '@/lib/i18n'
import type { ContentCounts, JobRunSummary, PlatformActivityPoint } from '@/lib/data/admin'

/**
 * Panonun sunucu tarafı parçaları: sayı kutuları, grafiğin metin karşılığı ve
 * cron durum tablosu. Hiçbiri istemci paketine girmez.
 */

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-foreground text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

/**
 * Grafiğin erişilebilir karşılığı.
 *
 * Görsel olarak gizli ama ekran okuyucuya ve JavaScript kapalı tarayıcıya
 * açık: grafik `aria-hidden` olduğu için veriye ulaşmanın tek yolu budur.
 */
export function ActivityTable({
  points,
  labelOf,
}: {
  points: PlatformActivityPoint[]
  labelOf: (date: string) => string
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{t('admin.activityChartAlt')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('admin.chartDay')}</th>
            <th scope="col">{t('admin.statVideos')}</th>
            <th scope="col">{t('admin.statQuestions')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{labelOf(point.date)}</th>
              <td>{point.videosCompleted}</td>
              <td>{point.questionsAnswered}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ContentCountsCard({ counts }: { counts: ContentCounts }) {
  const rows: Array<[string, number]> = [
    ['admin.contentTopics', counts.topics],
    ['admin.contentVideos', counts.videos],
    ['admin.contentQuestions', counts.questions],
    ['admin.contentTests', counts.tests],
    ['admin.contentFlashcards', counts.flashcards],
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('admin.contentTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {rows.map(([key, value]) => (
            <div key={key} className="space-y-0.5">
              <dt className="text-muted-foreground text-xs">{t(key)}</dt>
              <dd className="text-foreground text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

const JOB_STATUS_LABEL = {
  running: 'admin.jobRunning',
  success: 'admin.jobSuccess',
  error: 'admin.jobError',
} as const

const JOB_STATUS_VARIANT = {
  running: 'secondary',
  success: 'success',
  error: 'destructive',
} as const

/**
 * Zamanlanmış işlerin son durumu.
 *
 * Sessizce başarısız olan bir cron başka hiçbir ekranda görünmez; hata mesajı
 * kısaltılmadan gösterilir çünkü işi düzeltecek kişi burada okuyor.
 */
export function JobRunsCard({ runs }: { runs: JobRunSummary[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('admin.jobsTitle')}</CardTitle>
        <p className="text-muted-foreground text-sm">{t('admin.jobsSubtitle')}</p>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <EmptyState title={t('admin.jobsEmptyTitle')} description={t('admin.jobsEmptyBody')} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.colJob')}</TableHead>
                  <TableHead>{t('admin.colStatus')}</TableHead>
                  <TableHead>{t('admin.colStarted')}</TableHead>
                  <TableHead>{t('admin.colDuration')}</TableHead>
                  <TableHead className="text-right">{t('admin.colAffected')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.jobName}>
                    <TableCell className="font-mono text-xs">{run.jobName}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={JOB_STATUS_VARIANT[run.status]}>
                          {t(JOB_STATUS_LABEL[run.status])}
                        </Badge>
                        {run.errorMessage ? (
                          <p className="text-destructive max-w-md text-xs">{run.errorMessage}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(run.startedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {formatDuration(run.startedAt, run.finishedAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {run.affectedRows ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Bitmemiş koşum için süre yerine "Bitmedi" yazılır; 0 saniye yanıltıcı olurdu. */
function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (finishedAt === null) return t('admin.jobUnfinished')
  const seconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000))
  if (!Number.isFinite(seconds)) return '—'
  if (seconds < 60) return `${seconds} sn`
  return fill('{minutes} dk {seconds} sn', {
    minutes: Math.floor(seconds / 60),
    seconds: seconds % 60,
  })
}
