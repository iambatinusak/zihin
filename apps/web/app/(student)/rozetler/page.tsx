import Link from 'next/link'
import { Flame, Sparkles } from 'lucide-react'
import { buttonVariants } from '@zihin/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { BadgeGrid } from '@/components/gamification/badge-grid'
import { LeaderboardTable } from '@/components/gamification/leaderboard-table'
import { LevelProgress } from '@/components/gamification/level-progress'
import { gamificationStrings } from '@/components/gamification/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { getBadgeBoard, getStreakSummary, getWeeklyLeaderboard } from '@/lib/data/gamification'
import { LEADERBOARD_SIZE } from '@/lib/gamification/leaderboard'
import { fill } from '@/lib/i18n'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Rozetler, seviye ve haftalık sıralama (ekran §9.14).
 *
 * Sayfa tamamen kullanıcıya özel veri okur; önbelleklenemez.
 *
 * İKİ İSTEMCİ: rozet ve seri kullanıcının kendi satırlarıdır, oturum
 * istemcisiyle okunur. Liderlik tablosu başka öğrencilerin satırlarını
 * gerektirir ve RLS bunu kapatır — yalnızca o okuma service-role istemcisiyle
 * yapılır ve dışarı kimlik değil, sadece görünen ad + XP çıkar.
 */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Rozetlerim' }

export default async function BadgesPage() {
  const s = gamificationStrings()
  const user = await requireOnboardedStudent('/rozetler')
  const supabase = await createSupabaseServerClient()

  const [badges, streak] = await Promise.all([
    getBadgeBoard(supabase, user.id),
    getStreakSummary(supabase, user.id),
  ])

  const earnedCount = badges.filter((badge) => badge.earned).length

  return (
    <div className="space-y-6">
      <PageHeader title={s.title} description={s.description} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Sparkles aria-hidden="true" className="text-primary size-4" />
              {s.levelTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LevelProgress xp={user.xp} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Flame aria-hidden="true" className="text-primary size-4" />
              {s.streakTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-8">
            <div>
              <p className="text-muted-foreground text-sm">{s.streakCurrent}</p>
              <p className="text-foreground text-2xl font-semibold tabular-nums">
                {streak.currentStreak === 0
                  ? s.streakNone
                  : fill(s.streakDays, { days: streak.currentStreak })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">{s.streakLongest}</p>
              <p className="text-foreground text-2xl font-semibold tabular-nums">
                {fill(s.streakDays, { days: streak.longestStreak })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{s.badgesTitle}</CardTitle>
          <CardDescription>{fill(s.badgesSubtitle, { earned: earnedCount })}</CardDescription>
        </CardHeader>
        <CardContent>
          <BadgeGrid items={badges} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{s.leaderboardTitle}</CardTitle>
          <CardDescription>{s.leaderboardSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardSection examId={user.examId} userId={user.id} optIn={user.leaderboardOptIn} />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Sıralama bölümü üç durumdan birini gösterir: sınav seçilmemiş, öğrenci
 * sıralamaya katılmıyor, ya da tablo. Katılmayan öğrenciye BOŞ bir tablo
 * göstermek yerine neden göremediği ve nereden açacağı söylenir.
 */
async function LeaderboardSection({
  examId,
  userId,
  optIn,
}: {
  examId: string | null
  userId: string
  optIn: boolean
}) {
  const s = gamificationStrings()

  if (examId === null) {
    return (
      <EmptyState
        title={s.noExamTitle}
        description={s.noExamDescription}
        action={
          <Link href="/onboarding" className={buttonVariants({ size: 'sm' })}>
            {s.noExamAction}
          </Link>
        }
      />
    )
  }

  if (!optIn) {
    return (
      <EmptyState
        title={s.leaderboardOptOutTitle}
        description={s.leaderboardOptOutDescription}
        action={
          <Link href="/ayarlar" className={buttonVariants({ size: 'sm' })}>
            {s.leaderboardOptOutAction}
          </Link>
        }
      />
    )
  }

  const board = await getWeeklyLeaderboard(createSupabaseAdminClient(), {
    examId,
    currentUserId: userId,
    anonymousLabel: s.leaderboardAnonymous,
  })

  if (board.rows.length === 0) {
    return (
      <EmptyState title={s.leaderboardEmptyTitle} description={s.leaderboardEmptyDescription} />
    )
  }

  return <LeaderboardTable rows={board.rows} limit={LEADERBOARD_SIZE} />
}
