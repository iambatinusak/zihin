import { Suspense } from 'react'
import { Skeleton } from '@zihin/ui/skeleton'
import { PageHeader } from '@/components/common/page-header'
import { TodayPanel } from '@/components/program/today-panel'
import { DueCardsCard } from '@/components/dashboard/due-cards-card'
import { LastMockCard } from '@/components/dashboard/last-mock-card'
import { LevelCard } from '@/components/dashboard/level-card'
import { PlacementCta } from '@/components/dashboard/placement-cta'
import {
  PriorityTopicsCard,
  type PriorityTopicItem,
} from '@/components/dashboard/priority-topics-card'
import { StreakCard } from '@/components/dashboard/streak-card'
import { WeeklyActivityCard } from '@/components/dashboard/weekly-activity-card'
import { dashboardStrings } from '@/components/dashboard/strings'
import { fill } from '@/lib/i18n'
import { requireOnboardedStudent } from '@/lib/auth'
import { displayNameOf } from '@/lib/display-name'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { turkeyDayKey } from '@/lib/activity/day'
import { countDueReviews } from '@/lib/data/cards'
import { getLastMockResult, getWeeklyActivity, resolveTopicHrefs } from '@/lib/data/dashboard'
import { getPriorityTopics } from '@/lib/data/mastery'
import { getPlacementStatus } from '@/lib/data/placement'

/**
 * Öğrenci gösterge paneli (spec §9.3).
 *
 * TASARIM KARARI — BOŞ DURUM: bu, gerçek bir öğrencinin gördüğü İLK ekran ve
 * o an her kutu boştur. Bu yüzden panel "veri yok" demez; yeni kullanıcıya tek
 * bir sonraki adım önerir (seviye tespit sınavı) ve ikinci bir çıkış bırakır
 * (/dersler). Kutular kaybolmaz — ne olacaklarını anlatarak dururlar, çünkü
 * kaybolan kutu öğrenciye sistemin bozuk olduğunu düşündürüyor.
 *
 * Veri okuma paralel: kutular birbirini beklemez. "Bugünün programı" kendi
 * verisini kendi okuyor (program ajanının sözleşmesi) ve `<Suspense>` içinde
 * yavaş kalırsa panelin geri kalanını geciktirmez.
 */

export const metadata = { title: 'Panelim' }
export const dynamic = 'force-dynamic'

const PRIORITY_COUNT = 3

export default async function DashboardPage() {
  const s = dashboardStrings()
  const user = await requireOnboardedStudent('/dashboard')
  const supabase = await createSupabaseServerClient()

  const now = new Date()
  const todayKey = turkeyDayKey(now)

  const [placement, dueCount, weekly, lastMock, priority] = await Promise.all([
    getPlacementStatus(supabase, user.id, now),
    countDueReviews(supabase, user.id, now.toISOString()),
    getWeeklyActivity(supabase, user.id, now),
    getLastMockResult(supabase, user.id),
    user.examId
      ? getPriorityTopics(supabase, user.id, user.examId, PRIORITY_COUNT)
      : Promise.resolve([]),
  ])

  // Ölçülmemiş konular önceliklendirmede nötr puanla yer alır; panelde onları
  // "öncelik" diye göstermek yanıltıcı olurdu. Hiç ölçüm yoksa liste boş
  // bırakılır ve boş durum metni öğrenciyi seviye tespitine yollar.
  const measured = priority.filter((entry) => entry.status !== 'unknown')
  const hrefs = await resolveTopicHrefs(
    supabase,
    measured.map((entry) => entry.topic.id),
  )

  const priorityItems: PriorityTopicItem[] = measured.map((entry) => ({
    topicId: entry.topic.id,
    title: entry.topic.title,
    mastery: entry.mastery,
    status: entry.status,
    href: hrefs.get(entry.topic.id) ?? null,
  }))

  const hasActivity = weekly.some((point) => point.studySeconds > 0)
  const brandNew =
    !placement.completed && !hasActivity && measured.length === 0 && dueCount === 0 && !lastMock

  return (
    <div className="space-y-6">
      <PageHeader
        title={fill(s.greeting, { name: displayNameOf(user) })}
        description={s.subtitle}
      />

      {placement.completed ? null : (
        <PlacementCta resumable={placement.resumableSessionId !== null} brandNew={brandNew} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<Skeleton className="h-48 w-full lg:col-span-2" />}>
          {/* Program ajanının sözleşmesi: kendi verisini kendisi okur. */}
          <TodayPanel userId={user.id} date={todayKey} className="lg:col-span-2" />
        </Suspense>

        <PriorityTopicsCard topics={priorityItems} />
        <StreakCard currentStreak={user.currentStreak} />
        <LevelCard xp={user.xp} />
        <DueCardsCard dueCount={dueCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyActivityCard points={weekly} todayKey={todayKey} />
        </div>
        <LastMockCard result={lastMock} />
      </div>
    </div>
  )
}
