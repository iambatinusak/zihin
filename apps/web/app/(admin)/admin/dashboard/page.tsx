import { Card, CardContent, CardHeader, CardTitle } from '@zihin/ui/card'
import { PageHeader } from '@/components/common/page-header'
import { ActivityChart } from '@/components/admin/dashboard/activity-chart'
import {
  ActivityTable,
  ContentCountsCard,
  JobRunsCard,
  StatCard,
} from '@/components/admin/dashboard/panels'
import { requireRole } from '@/lib/auth'
import { CONTENT_ROLES } from '@/lib/roles'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { lastDayKeys, longDayLabel, weekdayLabel } from '@/lib/activity/day'
import {
  getContentCounts,
  getLatestJobRuns,
  getPlatformActivity,
  getRevenueSummary,
} from '@/lib/data/admin'
import { formatTry } from '@/lib/billing/money'
import { fill, t } from '@/lib/i18n'

/**
 * Yönetim panosu (spec §M15).
 *
 * ── KİM NEYİ GÖRÜR ─────────────────────────────────────────────────────────
 * Sayfa editöre de açıktır (içerik hacmi ve kullanım onun da işine yarar), ama
 * CİRO ve ZAMANLANMIŞ İŞLER yalnızca yöneticiye basılır. Bu bir arayüz kararı
 * DEĞİL, veri kararıdır: `payments` ve `job_runs` sorguları rol yöneticiyse
 * hiç çalıştırılmaz. 0011'deki politikalar da editöre bu tabloları vermez —
 * yani sorgu elle çağrılsa bile boş döner.
 */

export const metadata = { title: 'Genel Bakış' }
export const dynamic = 'force-dynamic'

const WINDOW_DAYS = 7

export default async function AdminDashboardPage() {
  const user = await requireRole(CONTENT_ROLES)
  const isAdmin = user.role === 'admin'

  const supabase = await createSupabaseServerClient()
  const now = new Date()
  const dayKeys = lastDayKeys(now, WINDOW_DAYS)
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [activity, content, revenue, jobs] = await Promise.all([
    getPlatformActivity(supabase, dayKeys),
    getContentCounts(supabase),
    isAdmin ? getRevenueSummary(supabase, since) : Promise.resolve(null),
    isAdmin ? getLatestJobRuns(supabase) : Promise.resolve(null),
  ])

  const points = activity.points.map((point) => ({
    date: point.date,
    label: weekdayLabel(point.date),
    videos: point.videosCompleted,
    questions: point.questionsAnswered,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.dashboardTitle')}
        description={t('admin.dashboardSubtitle')}
        breadcrumb={[{ label: 'Yönetim' }, { label: t('admin.dashboardTitle') }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('admin.statActiveUsers')}
          value={String(activity.activeUsers)}
          hint={t('admin.statActiveUsersHint')}
        />
        <StatCard label={t('admin.statVideos')} value={String(activity.videosCompleted)} />
        <StatCard label={t('admin.statQuestions')} value={String(activity.questionsAnswered)} />

        {revenue === null ? (
          <StatCard label={t('admin.statRevenue')} value="—" hint={t('admin.revenueOnlyAdmin')} />
        ) : (
          <StatCard
            label={t('admin.statRevenue')}
            value={formatTry(revenue.totalTry)}
            hint={
              <>
                {fill(t('admin.statRevenuePeriod'), { amount: formatTry(revenue.periodTry) })}
                {' · '}
                {fill(t('admin.statRevenueHint'), { sandbox: revenue.sandboxPayments })}
              </>
            }
          />
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('admin.activityChartTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityChart
            points={points}
            videoLabel={t('admin.statVideos')}
            questionLabel={t('admin.statQuestions')}
          />
          <ActivityTable points={activity.points} labelOf={longDayLabel} />
        </CardContent>
      </Card>

      <ContentCountsCard counts={content} />

      {jobs === null ? null : <JobRunsCard runs={jobs} />}
    </div>
  )
}
