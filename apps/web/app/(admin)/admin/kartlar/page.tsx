import type { Metadata } from 'next'

import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { CurriculumFilter } from '@/components/admin/media/curriculum-filter'
import { FlashcardEditor } from '@/components/admin/media/flashcard-editor'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminFlashcards } from '@/lib/data/admin-media'
import { loadCurriculumSelection, type RawSearchParams } from '@/lib/media/selection'
import { t } from '@/lib/i18n'

/** Editör bilgi kartları (spec §M15). Otomatik öğrenci kartları burada YOKTUR. */

export const metadata: Metadata = { title: 'Bilgi kartları' }
export const dynamic = 'force-dynamic'

export default async function AdminFlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const params = await searchParams
  const selection = await loadCurriculumSelection(supabase, params)

  const cards = selection.topicId ? await getAdminFlashcards(supabase, selection.topicId) : []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminMedia.cardsTitle')}
        description={t('adminMedia.cardsSubtitle')}
        breadcrumb={[
          { label: t('adminMedia.breadcrumbRoot'), href: '/admin/dashboard' },
          { label: t('adminMedia.cardsTitle') },
        ]}
      />

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
        <FlashcardEditor topicId={selection.topicId} cards={cards} />
      )}
    </div>
  )
}
