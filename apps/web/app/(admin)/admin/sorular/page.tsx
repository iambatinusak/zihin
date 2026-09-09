import Link from 'next/link'
import { FileUp, Plus } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { QuestionFilters } from '@/components/admin/questions/question-filters'
import { QuestionTable } from '@/components/admin/questions/question-table'
import { questionStrings } from '@/components/admin/questions/strings'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, getTopicOptions, listQuestions } from '@/lib/data/admin-questions'

export const metadata = { title: 'Soru Bankası' }

/**
 * Soru listesi (spec §M15).
 *
 * Bu ekran DOĞRU CEVABI OKUMAZ: veri katmanı `correct_option` ve `explanation`
 * kolonlarını hiç istemez, bu yüzden normal RSC istemcisi (RLS geçerli) yeter.
 * Doğru cevaba yalnızca düzenleme sayfası, service-role yolundan erişir.
 */
type SearchParams = Record<string, string | string[] | undefined>

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRole(['editor', 'admin'])

  const params = await searchParams
  const s = questionStrings()
  const supabase = await createSupabaseServerClient()

  const topics = await getTopicOptions(supabase)

  const values = {
    examId: single(params.sinav),
    subjectId: single(params.ders),
    topicId: single(params.konu),
    difficulty: single(params.zorluk),
    published: single(params.durum),
    search: single(params.q),
  }
  const page = Math.max(1, Number(single(params.sayfa)) || 1)

  const result = await listQuestions(
    supabase,
    {
      examId: values.examId || null,
      subjectId: values.subjectId || null,
      topicId: values.topicId || null,
      difficulty: values.difficulty === '' ? null : Number(values.difficulty) || null,
      published: publishedFilter(values.published),
      search: values.search || null,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    },
    topics,
  )

  const hasFilters = Object.values(values).some((value) => value !== '')

  function buildPageHref(target: number): string {
    const query = new URLSearchParams()
    if (values.examId) query.set('sinav', values.examId)
    if (values.subjectId) query.set('ders', values.subjectId)
    if (values.topicId) query.set('konu', values.topicId)
    if (values.difficulty) query.set('zorluk', values.difficulty)
    if (values.published) query.set('durum', values.published)
    if (values.search) query.set('q', values.search)
    if (target > 1) query.set('sayfa', String(target))
    const suffix = query.toString()
    return suffix === '' ? '/admin/sorular' : `/admin/sorular?${suffix}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.title}
        description={s.description}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/sorular/ice-aktar">
                <FileUp aria-hidden="true" className="size-4" />
                {s.import}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/sorular/yeni">
                <Plus aria-hidden="true" className="size-4" />
                {s.new}
              </Link>
            </Button>
          </>
        }
      />

      <QuestionFilters topics={topics} values={values} />

      {result.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? s.noResultsTitle : s.emptyTitle}
          description={hasFilters ? s.noResultsDescription : s.emptyDescription}
          action={
            hasFilters ? (
              <Button variant="outline" asChild>
                <Link href="/admin/sorular">{s.reset}</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/sorular/yeni">{s.new}</Link>
              </Button>
            )
          }
        />
      ) : (
        <QuestionTable result={result} buildPageHref={buildPageHref} />
      )}
    </div>
  )
}

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? ''
  return value?.trim() ?? ''
}

function publishedFilter(value: string): boolean | null {
  if (value === 'yayinda') return true
  if (value === 'taslak') return false
  return null
}
