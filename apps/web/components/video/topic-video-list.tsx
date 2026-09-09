import Link from 'next/link'
import { PlayCircle } from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import type { Tables } from '@zihin/db/types'
import { formatClock } from './format'
import type { VideoStrings } from './strings'

/**
 * Aynı konudaki diğer videolar. İzlenmekte olan video listede kalır ama
 * bağlantı değil, "şu an izliyorsunuz" olarak işaretlenir.
 */
export function TopicVideoList({
  videos,
  currentVideoId,
  strings,
}: {
  videos: Tables<'videos'>[]
  currentVideoId: string
  strings: VideoStrings
}) {
  const others = videos.filter((video) => video.id !== currentVideoId)

  return (
    <section aria-labelledby="konu-videolari" className="space-y-3">
      <h2 id="konu-videolari" className="text-foreground text-base font-semibold">
        {strings.otherVideos}
      </h2>

      {others.length === 0 ? (
        <p className="text-muted-foreground text-sm">{strings.otherVideosEmpty}</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {videos.map((video) => {
            const isCurrent = video.id === currentVideoId
            const meta = (
              <>
                <span className="text-foreground block text-sm font-medium">{video.title}</span>
                <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{strings.types[video.type]}</Badge>
                  {video.is_free_preview ? (
                    <Badge variant="success">{strings.freePreview}</Badge>
                  ) : null}
                  <span className="tabular-nums">{formatClock(video.duration_seconds)}</span>
                </span>
              </>
            )

            return (
              <li key={video.id}>
                {isCurrent ? (
                  <div
                    aria-current="true"
                    className="bg-muted/60 flex items-center gap-3 px-3 py-3"
                  >
                    <PlayCircle aria-hidden="true" className="text-primary size-5 shrink-0" />
                    <span className="min-w-0 flex-1">{meta}</span>
                    <Badge variant="outline" className="shrink-0">
                      {strings.currentVideo}
                    </Badge>
                  </div>
                ) : (
                  <Link
                    href={`/video/${video.id}`}
                    className="hover:bg-muted/60 focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2"
                  >
                    <PlayCircle
                      aria-hidden="true"
                      className="text-muted-foreground size-5 shrink-0"
                    />
                    <span className="min-w-0 flex-1">{meta}</span>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
