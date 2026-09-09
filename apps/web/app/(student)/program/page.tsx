import Link from 'next/link'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { PlanBoard } from '@/components/program/plan-board'
import { PlanToolbar } from '@/components/program/plan-toolbar'
import { PlanWarnings } from '@/components/program/plan-warnings'
import { WeekNav } from '@/components/program/week-nav'
import type { ProgramStrings } from '@/components/program/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { getWeekPlan } from '@/lib/data/plan'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  diffDays,
  isIsoDate,
  todayIso,
  weekDates,
  weekStartOf,
  weekStartOfIso,
} from '@/lib/plan/week'
import { section } from '@/lib/i18n'

/** Kullanıcıya özel plan okunur; statik önbellek anlamsız olurdu. */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Programım' }

export default async function ProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ hafta?: string }>
}) {
  const s = section<ProgramStrings>('program')
  const user = await requireOnboardedStudent('/program')

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

  const now = new Date()
  const today = todayIso(now)
  const currentWeekStart = weekStartOf(now)

  // Adres çubuğundaki hafta doğrulanır: bozuk değer sessizce bu haftaya düşer.
  const params = await searchParams
  const requested = params.hafta
  const weekStart = requested && isIsoDate(requested) ? weekStartOfIso(requested) : currentWeekStart

  const supabase = await createSupabaseServerClient()
  const { plan, blocks } = await getWeekPlan(supabase, user.id, weekStart)

  const isPastWeek = diffDays(weekStart, currentWeekStart) < 0

  return (
    <div className="space-y-6">
      <PageHeader title={s.title} description={s.description} />

      <WeekNav weekStart={weekStart} currentWeekStart={currentWeekStart} strings={s} />

      {isPastWeek ? <p className="text-muted-foreground text-sm">{s.pastWeekNotice}</p> : null}

      <PlanToolbar
        weekStart={weekStart}
        currentTemplate={plan?.template ?? 'balanced'}
        strings={s}
        disabled={isPastWeek}
      />

      {plan ? <PlanWarnings warnings={plan.warnings} strings={s} /> : null}

      {plan === null ? (
        <EmptyState title={s.emptyTitle} description={s.emptyDescription} />
      ) : (
        <>
          <p className="text-muted-foreground text-sm tabular-nums">
            {blocks.length} {s.summaryBlocks} ·{' '}
            {blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0)} {s.summaryMinutes} ·{' '}
            {blocks.filter((block) => block.completedAt !== null).length} {s.summaryCompleted}
          </p>

          <PlanBoard
            weekDays={weekDates(weekStart)}
            today={today}
            blocks={blocks}
            strings={s}
            readOnly={isPastWeek}
          />
        </>
      )}
    </div>
  )
}
