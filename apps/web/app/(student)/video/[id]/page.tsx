import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { Markdown } from '@/components/common/markdown'
import { rethrowAsNotFound } from '@/components/catalog/not-found'
import { LockedVideo, UnavailableVideo } from '@/components/video/locked-video'
import { TopicVideoList } from '@/components/video/topic-video-list'
import { VideoWorkspace } from '@/components/video/video-workspace'
import { formatClock } from '@/components/video/format'
import type { VideoStrings } from '@/components/video/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCheckpointsForVideo, getNotesForVideo, getVideoProgress } from '@/lib/data/video'
import { getVideoPageData } from '@/lib/data/video-page'
import { section } from '@/lib/i18n'
import { getSignedVideoUrl } from '../actions'

/**
 * Video izleme ekranı (spec §9.7).
 *
 * İmzalı bağlantı sunucuda üretilir: ödeme duvarına takılan kullanıcı
 * oynatıcıyı hiç görmez, doğrudan kilitli durumu görür. Bağlantının 4 saatlik
 * ömrü sayfanın kendisinden uzun olduğu için istemcide yenileme gerekmez;
 * daha uzun oturumda oynatıcı `playerError` durumuna düşer ve sayfa yenilenir.
 */
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

/** Yol parametresi bir UUID değilse hiç sorgu yapmadan 404. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function VideoPage({ params }: PageProps) {
  const s = section<VideoStrings>('video')
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const user = await requireOnboardedStudent(`/video/${id}`)
  const supabase = await createSupabaseServerClient()

  const page = await getVideoPageData(supabase, id).catch(rethrowAsNotFound)
  const { video, topic, unit, subject, outcomes, siblingVideos } = page

  const signed = await getSignedVideoUrl({ videoId: id })

  const [checkpoints, progress, notes] = await Promise.all([
    getCheckpointsForVideo(supabase, id),
    getVideoProgress(supabase, user.id, id),
    getNotesForVideo(supabase, user.id, id),
  ])

  const topicHref = `/dersler/${subject.slug}/${unit.slug}/${topic.slug}`

  const header = (
    <PageHeader
      title={video.title}
      breadcrumb={[
        { label: subject.name, href: `/dersler/${subject.slug}` },
        { label: unit.name },
        { label: topic.title, href: topicHref },
        { label: video.title },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{s.types[video.type]}</Badge>
          {video.is_free_preview ? <Badge variant="success">{s.freePreview}</Badge> : null}
          {progress?.completed_at ? <Badge variant="success">{s.completed}</Badge> : null}
          <span className="text-muted-foreground flex items-center gap-1 text-sm tabular-nums">
            <Clock aria-hidden="true" className="size-4" />
            <span className="sr-only">{s.duration}: </span>
            {formatClock(video.duration_seconds)}
          </span>
        </div>
      }
    />
  )

  const backLink = (
    <Link href={topicHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
      {s.backToTopic}
    </Link>
  )

  if (!signed.ok) {
    const locked = signed.error.code === 'subscription_required'
    return (
      <div className="min-w-0 space-y-6">
        {header}
        {locked ? (
          <LockedVideo strings={s} />
        ) : (
          <UnavailableVideo strings={s} message={signed.error.message} />
        )}
        <TopicVideoList videos={siblingVideos} currentVideoId={video.id} strings={s} />
        {backLink}
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      {header}

      <VideoWorkspace
        videoId={video.id}
        src={signed.data.url}
        durationSeconds={signed.data.durationSeconds || video.duration_seconds}
        posterUrl={video.thumbnail_url}
        startAtSeconds={progress?.last_position_seconds ?? 0}
        initialWatchedSeconds={progress?.watch_time_seconds ?? 0}
        alreadyCompleted={progress?.completed_at !== null && progress?.completed_at !== undefined}
        checkpoints={checkpoints.map((checkpoint) => ({
          id: checkpoint.id,
          timestampSeconds: checkpoint.timestampSeconds,
          question: {
            id: checkpoint.question.id,
            stem: checkpoint.question.stem,
            options: checkpoint.question.options,
            imageUrl: checkpoint.question.imageUrl,
          },
        }))}
        initialNotes={notes.map((note) => ({
          id: note.id,
          timestampSeconds: note.timestamp_seconds,
          body: note.body,
        }))}
        strings={s}
        outcomesSlot={
          outcomes.length > 0 ? (
            <ul className="space-y-2">
              {outcomes.map((outcome) => (
                <li key={outcome.id} className="border-border rounded-md border p-3">
                  <p className="text-muted-foreground text-xs font-medium">{outcome.code}</p>
                  <p className="text-foreground mt-1 text-sm">{outcome.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{s.outcomesEmpty}</p>
          )
        }
        memoryNoteSlot={
          topic.memory_note && topic.memory_note.trim().length > 0 ? (
            <article className="border-border rounded-lg border p-3">
              <Markdown content={topic.memory_note} />
            </article>
          ) : (
            <p className="text-muted-foreground text-sm">{s.memoryNoteEmpty}</p>
          )
        }
      />

      <TopicVideoList videos={siblingVideos} currentVideoId={video.id} strings={s} />
      {backLink}
    </div>
  )
}
