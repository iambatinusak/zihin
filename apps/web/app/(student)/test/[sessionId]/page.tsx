import { redirect } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { Markdown } from '@/components/common/markdown'
import { StartTestButton } from '@/components/test/start-test-button'
import { TestRunner, type RunnerQuestion } from '@/components/test/test-runner'
import type { TestStrings } from '@/components/test/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSession, getSessionAttempts, getTestById, getTestQuestions } from '@/lib/data/test'
import { isSessionResumable } from '@/lib/test-engine/session'
import { section } from '@/lib/i18n'

/**
 * Test çözme sayfası (spec §9.8).
 *
 * Yetki denetimi düzendedir (`(student)/layout.tsx`); burada yalnızca oturumun
 * SAHİPLİĞİ ve DURUMU denetlenir. Soru metinleri sunucuda Markdown olarak
 * basılır ve hazır düğüm olarak istemci bileşenine geçer — KaTeX ve temizleme
 * şeması istemci paketine girmez.
 */

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PageProps = { params: Promise<{ sessionId: string }> }

export default async function TestSessionPage({ params }: PageProps) {
  const s = section<TestStrings>('test')
  const { sessionId } = await params
  const user = await requireOnboardedStudent()

  // Bozuk kimlik veritabanına hiç gitmez; kullanıcıya hata ekranı yerine
  // anlaşılır bir açıklama gösterilir.
  if (!UUID.test(sessionId)) return <SessionNotFound strings={s} />

  const supabase = await createSupabaseServerClient()

  const session = await getSession(supabase, sessionId, user.id).catch(() => null)
  if (!session) return <SessionNotFound strings={s} />

  // Bitmiş oturumda çözme ekranının anlamı yok; sonuç ekranı tek doğru yer.
  if (session.finished_at !== null) redirect(`/sonuc/${sessionId}`)

  // Test yayımdan kaldırılmış ya da silinmiş olabilir; oturum kimliği geçerli
  // olsa da çözülecek bir şey kalmamıştır.
  const test = await getTestById(supabase, session.test_id).catch(() => null)
  if (!test) return <SessionNotFound strings={s} />

  const questions = await getTestQuestions(supabase, session.test_id)

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
          title={s.emptyTestTitle}
          description={s.emptyTest}
          action={
            <Link href="/dersler" className={buttonVariants({ variant: 'outline' })}>
              {s.backToLessons}
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
          action={<StartTestButton input={{ testId: test.id }}>{s.restart}</StartTestButton>}
        />
      </div>
    )
  }

  const attempts = await getSessionAttempts(supabase, session.id, user.id)
  const initialAnswers: Record<string, string | null> = {}
  for (const attempt of attempts) {
    initialAnswers[attempt.question_id] = attempt.selected_option
  }

  const runnerQuestions: RunnerQuestion[] = ordered.map((question) => ({
    id: question.id,
    stem: <Markdown content={question.stem} className="text-base" />,
    imageUrl: question.imageUrl,
    options: question.options.map((option) => ({
      key: option.key,
      // Şık metni de Markdown: formül ve üst simge içerebiliyor.
      label: <Markdown content={option.text} className="[&_p:last-child]:mb-0" />,
    })),
  }))

  return (
    <div className="space-y-6">
      <PageHeader title={test.title} description={s.autosaveHint} />
      <TestRunner
        sessionId={session.id}
        questions={runnerQuestions}
        initialAnswers={initialAnswers}
        durationSeconds={test.duration_seconds}
        startedAt={session.started_at}
        resumed={attempts.length > 0}
      />
    </div>
  )
}

function SessionNotFound({ strings }: { strings: TestStrings }) {
  return (
    <EmptyState
      title={strings.notFoundTitle}
      description={strings.notFoundBody}
      action={
        <Link href="/dersler" className={buttonVariants({ variant: 'outline' })}>
          {strings.backToLessons}
        </Link>
      }
    />
  )
}
