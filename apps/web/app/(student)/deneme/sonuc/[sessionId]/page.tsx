import Link from 'next/link'
import { redirect } from 'next/navigation'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { Markdown } from '@/components/common/markdown'
import { AddWrongToCardsButton } from '@/components/test/add-wrong-to-cards-button'
import { ResultBreakdown } from '@/components/test/result-breakdown'
import { ResultReview, type ReviewItem } from '@/components/test/result-review'
import { MockSectionTable } from '@/components/mock/mock-section-table'
import { PercentileCard } from '@/components/mock/percentile-card'
import { StartMockButton } from '@/components/mock/start-mock-button'
import type { MockStrings } from '@/components/mock/strings'
import { getMockResult } from '@/app/(student)/deneme/actions'
import { getResult } from '@/app/(student)/test/actions'
import { requireUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTopicLabels } from '@/lib/data/topic-labels'
import { getTopicMasteries } from '@/lib/data/mastery'
import { section } from '@/lib/i18n'

/**
 * Deneme sonucu (spec §M10, ekran §9.12).
 *
 * İKİ KAPI, İKİ SORUMLULUK:
 *  • `getMockResult` — ders bazlı net, genel net ve yüzdelik dilim. Doğru şıkkı
 *    hiç görmez; doğru/yanlış kararı `attempts.is_correct` içinde kayıtlıdır.
 *  • `getResult` — konu kırılımı ve soru çözümleri (doğru şık, açıklama, çözüm
 *    videosu). Yalnızca BİTMİŞ bir oturum için açılır.
 * İkisi de sahipliği ve oturumun bitmiş olmasını kendisi denetler; bu sayfa
 * cevap anahtarına üçüncü bir kapı açmaz.
 *
 * Yetkinlik burada YENİDEN HESAPLANMAZ: `finishTest` gönderim anında
 * `recalculateQuietly` çağırıp `topic_mastery`yi yazdı (spec §M6). İkinci bir
 * yazıcı eklemek aynı gerçeği iki yerden güncellemek olurdu; bu sayfa yalnızca
 * o taze satırları okur.
 */

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ sessionId: string }> }

export default async function MockResultPage({ params }: PageProps) {
  const s = section<MockStrings>('mock')
  const { sessionId } = await params

  const mock = await getMockResult({ sessionId })

  if (!mock.ok) {
    // Deneme hâlâ sürüyorsa sonuç yok; kullanıcı çözmeye geri döner.
    if (mock.error.code === 'forbidden') redirect(`/deneme/${sessionId}`)
    return (
      <EmptyState
        title={s.notFoundTitle}
        description={mock.error.message}
        action={
          <Link href="/deneme" className={buttonVariants({ variant: 'outline' })}>
            {s.backToList}
          </Link>
        }
      />
    )
  }

  const result = await getResult({ sessionId })
  const detail = result.ok ? result.data : null

  const viewer = await requireUser()
  const supabase = await createSupabaseServerClient()

  const topicIds = detail ? detail.summary.byTopic.map((topic) => topic.topicId) : []
  const labels = await getTopicLabels(supabase, topicIds)
  const mastery = await getTopicMasteries(supabase, viewer.id, topicIds)

  const wrongCount = detail
    ? detail.questions.filter((question) => question.selectedOption !== null && !question.isCorrect)
        .length
    : 0

  const items: ReviewItem[] = (detail?.questions ?? []).map((question) => ({
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.result.title}
        description={mock.data.testTitle}
        actions={
          <>
            <AddWrongToCardsButton sessionId={sessionId} wrongCount={wrongCount} />
            <StartMockButton testId={mock.data.testId} variant="outline">
              {s.retry}
            </StartMockButton>
            <Link href="/deneme" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              {s.backToList}
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <MockSectionTable summary={mock.data.summary} />
        <PercentileCard view={mock.data.percentile} rankingVisible={mock.data.rankingVisible} />
      </div>

      {detail ? (
        <ResultBreakdown byTopic={detail.summary.byTopic} labels={labels} mastery={mastery} />
      ) : null}

      {items.length === 0 ? (
        <EmptyState title={s.result.emptyTitle} description={s.result.emptyBody} />
      ) : (
        <ResultReview items={items} />
      )}
    </div>
  )
}
