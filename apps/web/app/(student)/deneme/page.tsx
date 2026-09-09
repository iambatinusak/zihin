import Link from 'next/link'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { MockCard, type MockCardSection } from '@/components/mock/mock-card'
import type { MockStrings } from '@/components/mock/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getMockQuestionLinks,
  getPublishedMocks,
  getUserSessionsForTests,
  readNet,
} from '@/lib/data/mock'
import { groupSections } from '@/lib/mock/sections'
import { mockAttemptState } from '@/lib/mock/status'
import { mockWindowState } from '@/lib/mock/window'
import { section } from '@/lib/i18n'

/**
 * Deneme listesi (ekran §9.12).
 *
 * Yetki denetimi düzendedir (`(student)/layout.tsx`); burada yalnızca doğru
 * sınavın denemeleri seçilir. Canlı pencere durumu SUNUCUDA hesaplanır ve
 * karta hazır olarak geçer — ama düğmenin görünmesi bir yetki değildir,
 * `startMock`/`startTest` pencereyi kendisi denetler.
 */

export const dynamic = 'force-dynamic'

export default async function MockListPage() {
  const s = section<MockStrings>('mock')
  const user = await requireOnboardedStudent()

  if (!user.examId) {
    return (
      <div className="space-y-6">
        <PageHeader title={s.title} description={s.subtitle} />
        <EmptyState
          title={s.noExamTitle}
          description={s.noExamBody}
          action={
            <Link href="/ayarlar" className={buttonVariants({ variant: 'outline' })}>
              {s.goSettings}
            </Link>
          }
        />
      </div>
    )
  }

  const supabase = await createSupabaseServerClient()
  const mocks = await getPublishedMocks(supabase, user.examId)

  if (mocks.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={s.title} description={s.subtitle} />
        <EmptyState title={s.emptyTitle} description={s.emptyBody} />
      </div>
    )
  }

  const testIds = mocks.map((mock) => mock.id)
  const links = await getMockQuestionLinks(supabase, testIds)
  const sessions = await getUserSessionsForTests(supabase, user.id, testIds)

  // "Şimdi" tek kez okunur: listedeki iki kartın farklı bir ana göre
  // değerlendirilmesi tutarsız bir ekran üretirdi.
  const now = new Date()

  return (
    <div className="space-y-6">
      <PageHeader title={s.title} description={s.subtitle} />

      <ul className="grid gap-4 md:grid-cols-2">
        {mocks.map((mock) => {
          const questionLinks = links.get(mock.id) ?? []
          const groups = groupSections(
            questionLinks.map((link) => ({
              questionId: link.questionId,
              section: link.section,
            })),
            s.otherSubject,
          )
          const cardSections: MockCardSection[] = groups.map((group) => ({
            name: group.name,
            count: group.questionIds.length,
          }))

          const mockSessions = (sessions.get(mock.id) ?? []).map((row) => ({
            id: row.id,
            finished_at: row.finishedAt,
            expires_at: row.expiresAt,
            started_at: row.startedAt,
          }))
          const state = mockAttemptState(mockSessions, now)

          const finishedSession =
            state.kind === 'finished'
              ? (sessions.get(mock.id) ?? []).find((row) => row.id === state.sessionId)
              : undefined

          return (
            <MockCard
              key={mock.id}
              testId={mock.id}
              title={mock.title}
              questionCount={questionLinks.length}
              targetQuestions={targetQuestions(mock.config)}
              durationSeconds={mock.duration_seconds}
              sections={cardSections}
              windowState={mockWindowState(mock, now)}
              liveWindowStart={mock.live_window_start}
              liveWindowEnd={mock.live_window_end}
              state={state}
              net={finishedSession ? readNet(finishedSession.summary) : null}
            />
          )
        })}
      </ul>
    </div>
  )
}

/**
 * `tests.config.targetQuestions` — denemenin hedeflediği soru sayısı.
 * Serbest bir jsonb olduğu için savunmacı okunur; okunamıyorsa uyarı gösterilmez.
 */
function targetQuestions(config: unknown): number | null {
  if (typeof config !== 'object' || config === null) return null
  const value = (config as Record<string, unknown>).targetQuestions
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}
