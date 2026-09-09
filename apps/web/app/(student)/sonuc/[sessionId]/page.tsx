import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { Markdown } from '@/components/common/markdown'
import { AddWrongToCardsButton } from '@/components/test/add-wrong-to-cards-button'
import { ResultBreakdown } from '@/components/test/result-breakdown'
import { ResultReview, type ReviewItem } from '@/components/test/result-review'
import { ResultSummary } from '@/components/test/result-summary'
import { StartTestButton } from '@/components/test/start-test-button'
import type { TestStrings } from '@/components/test/strings'
import { getResult } from '@/app/(student)/test/actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { getTopicLabels } from '@/lib/data/topic-labels'
import { getTopicMasteries } from '@/lib/data/mastery'
import { section } from '@/lib/i18n'

/**
 * Test sonucu (spec §9.9).
 *
 * Veri `getResult` action'ından okunur; doğru cevap, açıklama ve çözüm videosu
 * yalnızca orada, yalnızca BİTMİŞ bir oturum için açılır. Bitmemiş oturumda
 * action `forbidden` döner ve kullanıcı çözme ekranına geri yollanır — sonuç
 * sayfası cevap anahtarına ikinci bir kapı açmaz.
 */

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ sessionId: string }> }

export default async function ResultPage({ params }: PageProps) {
  const s = section<TestStrings>('test')
  const { sessionId } = await params

  // Yetki denetimi iki yerde: düzen guard'ı (`(student)/layout.tsx`) sayfayı,
  // `getResult` içindeki `assertRole` + sahiplik denetimi veriyi korur.
  const result = await getResult({ sessionId })

  if (!result.ok) {
    // Test hâlâ sürüyorsa sonuç yok; kullanıcı çözmeye geri döner.
    if (result.error.code === 'forbidden') redirect(`/test/${sessionId}`)
    return (
      <EmptyState
        title={s.notFoundTitle}
        description={result.error.message}
        action={
          <Link href="/dersler" className={buttonVariants({ variant: 'outline' })}>
            {s.backToLessons}
          </Link>
        }
      />
    )
  }

  const { summary, questions, testTitle, testId } = result.data

  const supabase = await createSupabaseServerClient()
  const labels = await getTopicLabels(
    supabase,
    summary.byTopic.map((topic) => topic.topicId),
  )

  // Yetkinlik `finishTest` içinde zaten yeniden hesaplandı; burada yalnızca
  // taze satırlar OKUNUR (spec §M6: panel iki saniye içinde güncel).
  const viewer = await requireUser()
  const mastery = await getTopicMasteries(
    supabase,
    viewer.id,
    summary.byTopic.map((topic) => topic.topicId),
  )

  const wrongCount = questions.filter(
    (question) => question.selectedOption !== null && !question.isCorrect,
  ).length

  const items: ReviewItem[] = questions.map((question) => ({
    questionId: question.questionId,
    stem: <Markdown content={question.stem} className="text-base" />,
    imageUrl: question.imageUrl,
    options: question.options.map((option) => ({
      key: option.key,
      label: <Markdown content={option.text} className="[&_p:last-child]:mb-0" />,
    })),
    selectedOption: question.selectedOption,
    correctOption: question.correctOption,
    isCorrect: question.isCorrect,
    explanation: question.explanation ? (
      <Markdown content={question.explanation} className="mt-1" />
    ) : null,
    solutionVideoUrl: question.solutionVideoUrl,
    bookmarked: question.bookmarked,
  }))

  // Sonuçtaki ilk konu, "konuya dön" bağlantısının hedefidir.
  const firstTopic = summary.byTopic[0]
  const topicLabel = firstTopic ? labels.get(firstTopic.topicId) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.result.title}
        description={testTitle}
        actions={
          <>
            <AddWrongToCardsButton sessionId={sessionId} wrongCount={wrongCount} />
            <StartTestButton input={{ testId }} variant="outline">
              {s.result.retry}
            </StartTestButton>
            {topicLabel ? (
              <Link
                href={`/dersler/${topicLabel.subjectSlug}/${topicLabel.unitSlug}/${topicLabel.topicSlug}`}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                {s.result.backToTopic}
              </Link>
            ) : null}
          </>
        }
      />

      <ResultSummary summary={summary} />

      <ResultBreakdown byTopic={summary.byTopic} labels={labels} mastery={mastery} />

      {items.length === 0 ? (
        <EmptyState title={s.emptyTestTitle} description={s.emptyTest} />
      ) : (
        <ResultReview items={items} />
      )}
    </div>
  )
}
