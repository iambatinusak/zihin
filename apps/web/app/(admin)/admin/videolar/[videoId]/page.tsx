import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/common/page-header'
import { VideoForm } from '@/components/admin/media/video-form'
import { CheckpointEditor } from '@/components/admin/media/checkpoint-editor'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminCheckpoints, getAdminVideo } from '@/lib/data/admin-media'
import { AppError } from '@/lib/errors'
import { t } from '@/lib/i18n'

/** Video düzenleme + zaman çubuğu durakları (spec §M15). */

export const metadata: Metadata = { title: 'Videoyu düzenle' }
export const dynamic = 'force-dynamic'

export default async function AdminVideoDetailPage({
  params,
}: {
  params: Promise<{ videoId: string }>
}) {
  await requireRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const { videoId } = await params

  const video = await getAdminVideo(supabase, videoId).catch((error: unknown) => {
    if (error instanceof AppError && error.code === 'not_found') notFound()
    throw error
  })

  const checkpoints = await getAdminCheckpoints(supabase, video.id)

  return (
    <div className="space-y-8">
      <PageHeader
        title={video.title}
        description={t('adminMedia.videoEdit')}
        breadcrumb={[
          { label: t('adminMedia.breadcrumbRoot'), href: '/admin/dashboard' },
          { label: t('adminMedia.videosTitle'), href: '/admin/videolar' },
          { label: video.title },
        ]}
      />

      <VideoForm topicId={video.topic_id} video={video} nextOrderIndex={video.order_index} />

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-foreground text-lg font-semibold">
            {t('adminMedia.checkpointsTitle')}
          </h2>
          <p className="text-muted-foreground text-sm">{t('adminMedia.checkpointsSubtitle')}</p>
        </div>

        <CheckpointEditor
          videoId={video.id}
          durationSeconds={video.duration_seconds}
          topicId={video.topic_id}
          checkpoints={checkpoints}
        />
      </section>
    </div>
  )
}
