import type { Metadata } from 'next'

import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { MockBuilder } from '@/components/admin/media/mock-builder'
import { TestList } from '@/components/admin/media/test-list'
import { ExamPicker } from '@/components/admin/media/exam-picker'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminExams, getAdminTests, getSubjectPools } from '@/lib/data/admin-media'
import { firstParam, type RawSearchParams } from '@/lib/media/selection'
import { t } from '@/lib/i18n'

/**
 * Deneme yönetimi (spec §M15).
 *
 * Konu seçimi yok: deneme sınav düzeyindedir ve ders başına soru sayısıyla
 * kurulur. Kurulan deneme, sıralama ve yayın için `/admin/testler/[id]`
 * ekranında düzenlenir — deneme de bir `tests` satırıdır.
 */

export const metadata: Metadata = { title: 'Denemeler' }
export const dynamic = 'force-dynamic'

export default async function AdminMockExamsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const params = await searchParams

  const exams = await getAdminExams(supabase)
  const requested = firstParam(params.sinav)
  const examId = exams.some((exam) => exam.id === requested) ? requested : null

  const mocks = await getAdminTests(supabase, { types: ['mock_exam'] })
  const pools = examId ? await getSubjectPools(supabase, examId) : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminMedia.mockTitle')}
        description={t('adminMedia.mockSubtitle')}
        breadcrumb={[
          { label: t('adminMedia.breadcrumbRoot'), href: '/admin/dashboard' },
          { label: t('adminMedia.mockTitle') },
        ]}
      />

      {mocks.length === 0 ? (
        <EmptyState
          title={t('adminMedia.mockEmptyTitle')}
          description={t('adminMedia.mockEmptyBody')}
        />
      ) : (
        <TestList items={mocks} />
      )}

      <section className="space-y-3">
        <h2 className="text-foreground text-lg font-semibold">{t('adminMedia.mockNew')}</h2>

        <ExamPicker exams={exams} examId={examId} />

        {examId === null ? (
          <EmptyState
            title={t('adminMedia.pickExamTitle')}
            description={t('adminMedia.pickExamBody')}
          />
        ) : pools.length === 0 ? (
          <EmptyState title={t('adminMedia.noSubjects')} />
        ) : (
          <MockBuilder examId={examId} pools={pools} />
        )}
      </section>
    </div>
  )
}
