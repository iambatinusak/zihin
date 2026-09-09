import Link from 'next/link'
import { buttonVariants } from '@zihin/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zihin/ui/tabs'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { MasteryLegend } from '@/components/panel/mastery-legend'
import { PriorityTopics } from '@/components/panel/priority-topics'
import { TopicHeatMap } from '@/components/panel/topic-heat-map'
import { LazyMasteryTrendChart, LazySubjectRadarChart } from '@/components/panel/charts'
import { RadarTable, TrendTable } from '@/components/panel/chart-tables'
import type { PanelStrings } from '@/components/panel/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { getMasteryMap, getMasteryTimeline, getPriorityTopics } from '@/lib/data/mastery'
import { getPriorityTopicRows, getUnitSlugs } from '@/lib/data/panel'
import {
  countByStatus,
  radarExtremes,
  shortWeekLabel,
  subjectAveragesFromMap,
  trendSummary,
} from '@/lib/panel/summaries'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fill, section, t } from '@/lib/i18n'

/*
 * Sayfa tamamen kullanıcıya özel veri okur (yetkinlik, öncelik, geçmiş);
 * önbelleklenemez.
 */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Akıllı Test Paneli' }

/** Zaman serisinde gösterilen hafta sayısı (brief §M6). */
const TREND_WEEKS = 8

export default async function PanelPage() {
  const s = section<PanelStrings>('panel')
  // Guard düzende çalıştı; burada yalnızca kimlik ve sınav için okunuyor.
  const user = await requireOnboardedStudent()

  if (!user.examId) {
    return (
      <div className="space-y-6">
        <PageHeader title={s.title} description={s.description} />
        <EmptyState
          title={s.noExamTitle}
          description={s.noExamDescription}
          action={
            <Link href="/onboarding" className={buttonVariants({ size: 'sm' })}>
              {s.noExamAction}
            </Link>
          }
        />
      </div>
    )
  }

  const supabase = await createSupabaseServerClient()

  // Harita bir kez okunur; ders ortalamaları ondan TÜRETİLİR (ikinci sorgu yok).
  const map = await getMasteryMap(supabase, user.id, user.examId)
  const subjects = subjectAveragesFromMap(map)

  if (map.measuredTopicCount === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={s.title} description={s.description} />
        <EmptyState
          title={s.emptyTitle}
          description={s.emptyDescription}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/seviye-tespit" className={buttonVariants({ size: 'sm' })}>
                {s.emptyPrimary}
              </Link>
              <Link href="/dersler" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {s.emptySecondary}
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  const priority = await getPriorityTopics(supabase, user.id, user.examId, 5)
  const [priorityRows, timeline, unitSlugMap] = await Promise.all([
    getPriorityTopicRows(supabase, priority, map),
    getMasteryTimeline(supabase, user.id, TREND_WEEKS),
    getUnitSlugs(
      supabase,
      map.subjects.flatMap((subject) => subject.units.map((unit) => unit.unitId)),
    ),
  ])

  const unitSlugs = Object.fromEntries(unitSlugMap)
  const counts = countByStatus(map)
  const extremes = radarExtremes(subjects)

  // Grafiklerin metin karşılığı sunucuda üretilir; grafik yüklenmese de durur.
  const trendText = trendSummary({
    points: timeline,
    template: s.trendSummary,
    singleTemplate: s.trendSummarySingle,
  })
  const radarText = extremes
    ? fill(s.radarSummary, {
        best: extremes.best.name,
        bestScore: extremes.best.averageMastery,
        worst: extremes.worst.name,
        worstScore: extremes.worst.averageMastery,
      })
    : null

  const firstSubject = map.subjects[0]

  return (
    <div className="space-y-6">
      <PageHeader title={s.title} description={s.description} />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={s.overallAverage} value={`${map.averageMastery}`} hint={s.outOfHundred} />
        <Stat
          label={s.measuredTopics}
          value={`${map.measuredTopicCount}`}
          hint={`/ ${map.topicCount}`}
        />
        <Stat label={t('mastery.title')} value={`${counts.strong}`} hint={t('mastery.strong')} />
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>{s.heatMapTitle}</CardTitle>
          <CardDescription>{s.heatMapDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MasteryLegend counts={counts} strings={s} />
          <p className="text-muted-foreground text-xs">{s.heatMapHint}</p>

          {firstSubject ? (
            <Tabs defaultValue={firstSubject.subjectId} className="gap-4">
              <TabsList aria-label={s.heatMapNavLabel} className="flex h-auto flex-wrap">
                {map.subjects.map((subject) => (
                  <TabsTrigger key={subject.subjectId} value={subject.subjectId}>
                    {subject.name}
                    <span className="text-muted-foreground ml-1 tabular-nums">
                      {subject.averageMastery}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {map.subjects.map((subject) => (
                <TabsContent key={subject.subjectId} value={subject.subjectId}>
                  <TopicHeatMap subject={subject} unitSlugs={unitSlugs} strings={s} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <EmptyState title={s.emptyTitle} description={s.emptyDescription} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{s.priorityTitle}</CardTitle>
          <CardDescription>{s.priorityDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <PriorityTopics rows={priorityRows} strings={s} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{s.trendTitle}</CardTitle>
            <CardDescription>{s.trendDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-muted-foreground text-sm">{s.trendEmpty}</p>
            ) : (
              <>
                {trendText ? (
                  <p className="text-muted-foreground mb-3 text-sm">{trendText}</p>
                ) : null}
                <LazyMasteryTrendChart
                  points={timeline.map((point) => ({
                    weekStart: point.weekStart,
                    label: shortWeekLabel(point.weekStart),
                    averageMastery: point.averageMastery,
                    sampleCount: point.sampleCount,
                  }))}
                  averageLabel={s.averageLabel}
                  weekLabel={s.weekLabel}
                />
                <TrendTable points={timeline} strings={s} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{s.radarTitle}</CardTitle>
            <CardDescription>{s.radarDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <p className="text-muted-foreground text-sm">{s.radarEmpty}</p>
            ) : (
              <>
                {radarText ? (
                  <p className="text-muted-foreground mb-3 text-sm">{radarText}</p>
                ) : null}
                <LazySubjectRadarChart
                  points={subjects.map((subject) => ({
                    subjectId: subject.subjectId,
                    subject: subject.name,
                    averageMastery: subject.averageMastery,
                    topicCount: subject.topicCount,
                    measuredTopicCount: subject.measuredTopicCount,
                  }))}
                  averageLabel={s.averageLabel}
                />
                <RadarTable subjects={subjects} strings={s} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {hint ? (
          <span className="text-muted-foreground ml-1 text-xs font-normal">{hint}</span>
        ) : null}
      </dd>
    </div>
  )
}
