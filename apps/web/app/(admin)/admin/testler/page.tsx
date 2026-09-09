import type { Metadata } from 'next'

import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { CurriculumFilter } from '@/components/admin/media/curriculum-filter'
import { TestBuilder } from '@/components/admin/media/test-builder'
import { TestList } from '@/components/admin/media/test-list'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminTests, getPublishedQuestionIdsForTopics } from '@/lib/data/admin-media'
import { loadCurriculumSelection, type RawSearchParams } from '@/lib/media/selection'
import { t } from '@/lib/i18n'

/** Konu ve ünite testleri (spec §M15). Denemeler ayrı ekranda. */

export const metadata: Metadata = { title: 'Testler' }
export const dynamic = 'force-dynamic'

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const params = await searchParams
  const selection = await loadCurriculumSelection(supabase, params)

  const tests = await getAdminTests(supabase, { types: ['topic_test', 'unit_test'] })

  // Havuz büyüklüğü "rastgele N soru" kuralının üst sınırını gösterir.
  const pool = selection.topicId
    ? await getPublishedQuestionIdsForTopics(supabase, [selection.topicId])
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminMedia.testsTitle')}
        description={t('adminMedia.testsSubtitle')}
        breadcrumb={[
          { label: t('adminMedia.breadcrumbRoot'), href: '/admin/dashboard' },
          { label: t('adminMedia.testsTitle') },
        ]}
      />

      {tests.length === 0 ? (
        <EmptyState
          title={t('adminMedia.testsEmptyTitle')}
          description={t('adminMedia.testsEmptyBody')}
        />
      ) : (
        <TestList items={tests} />
      )}

      <section className="space-y-3">
        <h2 className="text-foreground text-lg font-semibold">{t('adminMedia.testNew')}</h2>

        <CurriculumFilter
          exams={selection.exams}
          subjects={selection.subjects}
          topics={selection.topics}
          examId={selection.examId}
          subjectId={selection.subjectId}
          topicId={selection.topicId}
        />

        {selection.topicId === null ? (
          <EmptyState
            title={t('adminMedia.pickTopicTitle')}
            description={t('adminMedia.pickTopicBody')}
          />
        ) : (
          <TestBuilder topicId={selection.topicId} poolSize={pool.length} />
        )}
      </section>
    </div>
  )
}
