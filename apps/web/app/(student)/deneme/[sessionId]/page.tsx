import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { Markdown } from '@/components/common/markdown'
import { MockRunner } from '@/components/mock/mock-runner'
import { StartMockButton } from '@/components/mock/start-mock-button'
import type { MockStrings } from '@/components/mock/strings'
import type { RunnerQuestion } from '@/components/test/test-runner'
import { requireOnboardedStudent } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSession, getSessionAttempts, getTestById, getTestQuestions } from '@/lib/data/test'
import { isSessionResumable } from '@/lib/test-engine/session'
import { groupSections } from '@/lib/mock/sections'
import { section } from '@/lib/i18n'

/**
 * Deneme çözme sayfası (ekran §9.12).
 *
 * Konu testinin sayfasıyla aynı iskelet: yetki düzendedir, burada oturumun
 * SAHİPLİĞİ ve DURUMU denetlenir, soru metinleri SUNUCUDA Markdown olarak
 * basılıp hazır düğüm olarak istemciye geçer (KaTeX istemci paketine girmez).
 *
 * Denemeye özgü tek şey ders bölümleri: `test_questions.section` alanından
 * gruplanır ve `MockRunner`'a sekme + ızgara kaynağı olarak verilir.
 */

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PageProps = { params: Promise<{ sessionId: string }> }

export default async function MockSessionPage({ params }: PageProps) {
  const s = section<MockStrings>('mock')
  const { sessionId } = await params
  const user = await requireOnboardedStudent()

  if (!UUID.test(sessionId)) return <NotFound strings={s} />

  const supabase = await createSupabaseServerClient()

  const session = await getSession(supabase, sessionId, user.id).catch(() => null)
  if (!session) return <NotFound strings={s} />

  // Bitmiş oturumda çözme ekranının anlamı yok; sonuç ekranı tek doğru yer.
  if (session.finished_at !== null) redirect(`/deneme/sonuc/${sessionId}`)

  const test = await getTestById(supabase, session.test_id).catch(() => null)
  if (!test) return <NotFound strings={s} />
  // Konu testi oturumu bu rotaya elle girilmiş olabilir; kendi ekranına gider.
  if (test.type !== 'mock_exam') redirect(`/test/${sessionId}`)

  const questions = await getTestQuestions(supabase, test.id)
  const byId = new Map(questions.map((question) => [question.id, question]))
  const ordered = session.question_order.flatMap((id) => {
    const question = byId.get(id)
    return question ? [question] : []
  })

  if (ordered.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={test.title} />
        <EmptyState
          title={s.result.emptyTitle}
          description={s.result.emptyBody}
          action={
            <Link href="/deneme" className={buttonVariants({ variant: 'outline' })}>
              {s.backToList}
            </Link>
          }
        />
      </div>
    )
  }

  if (!isSessionResumable(session, new Date())) {
    return (
      <div className="space-y-6">
        <PageHeader title={test.title} />
        <EmptyState
          title={s.expiredTitle}
          description={s.expiredBody}
          action={<StartMockButton testId={test.id}>{s.start}</StartMockButton>}
        />
      </div>
    )
  }

  const attempts = await getSessionAttempts(supabase, session.id, user.id)
  const initialAnswers: Record<string, string | null> = {}
  for (const attempt of attempts) {
    initialAnswers[attempt.question_id] = attempt.selected_option
  }

  const sections = groupSections(
    ordered.map((question) => ({ questionId: question.id, section: question.section })),
    s.otherSubject,
  )

  const runnerQuestions: RunnerQuestion[] = ordered.map((question) => ({
    id: question.id,
    stem: <Markdown content={question.stem} className="text-base" />,
    imageUrl: question.imageUrl,
    options: question.options.map((option) => ({
      key: option.key,
      label: <Markdown content={option.text} className="[&_p:last-child]:mb-0" />,
    })),
  }))

  return (
    <div className="space-y-6">
      <PageHeader title={test.title} description={s.subtitle} />
      <MockRunner
        sessionId={session.id}
        questions={runnerQuestions}
        sections={sections}
        initialAnswers={initialAnswers}
        durationSeconds={test.duration_seconds}
        startedAt={session.started_at}
        resumed={attempts.length > 0}
      />
    </div>
  )
}

function NotFound({ strings }: { strings: MockStrings }) {
  return (
    <EmptyState
      title={strings.notFoundTitle}
      description={strings.notFoundBody}
      action={
        <Link href="/deneme" className={buttonVariants({ variant: 'outline' })}>
          {strings.backToList}
        </Link>
      }
    />
  )
}
