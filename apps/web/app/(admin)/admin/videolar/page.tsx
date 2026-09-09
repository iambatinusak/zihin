import type { Metadata } from 'next'

import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { CurriculumFilter } from '@/components/admin/media/curriculum-filter'
import { VideoForm } from '@/components/admin/media/video-form'
import { VideoList } from '@/components/admin/media/video-list'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminVideosForTopic, getNextVideoOrderIndex } from '@/lib/data/admin-media'
import { loadCurriculumSelection, type RawSearchParams } from '@/lib/media/selection'
import { t } from '@/lib/i18n'

/**
 * Video yönetimi (spec §M15).
 *
 * Sayfa `requireRole(['editor', 'admin'])` ile korunur; asıl denetim
 * `actions.ts` içindeki `assertRole` çağrılarıdır — düzenin guard'ı bir Server
 * Action'ı korumaz.
 */

export const metadata: Metadata = { title: 'Videolar' }
export const dynamic = 'force-dynamic'

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  await requireRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const params = await searchParams
  const selection = await loadCurriculumSelection(supabase, params)

  const videos = selection.topicId ? await getAdminVideosForTopic(supabase, selection.topicId) : []
  const nextOrderIndex = selection.topicId
    ? await getNextVideoOrderIndex(supabase, selection.topicId)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('adminMedia.videosTitle')}
        description={t('adminMedia.videosSubtitle')}
        breadcrumb={[
          { label: t('adminMedia.breadcrumbRoot'), href: '/admin/dashboard' },
          { label: t('adminMedia.videosTitle') },
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
        <div className="space-y-6">
          {videos.length === 0 ? (
            <EmptyState
              title={t('adminMedia.videosEmptyTitle')}
              description={t('adminMedia.videosEmptyBody')}
            />
          ) : (
            <VideoList videos={videos} />
          )}

          <section className="space-y-3">
            <h2 className="text-foreground text-lg font-semibold">{t('adminMedia.videoNew')}</h2>
            <VideoForm topicId={selection.topicId} video={null} nextOrderIndex={nextOrderIndex} />
          </section>
        </div>
      )}
    </div>
  )
}
