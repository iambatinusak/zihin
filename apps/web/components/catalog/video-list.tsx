import Link from 'next/link'
import { Lock, PlayCircle } from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import type { Video } from '@/lib/data'
import { section } from '@/lib/i18n'
import { formatDuration } from './progress'
import type { CatalogStrings } from './strings'
import { ContentEmpty } from './content-empty'

type VideoListProps = {
  videos: Video[]
  hasSubscription: boolean
}

/** Konunun videoları. Kilitli olmayan her satır /video/[id] oynatıcısına gider. */
export function VideoList({ videos, hasSubscription }: VideoListProps) {
  const s = section<CatalogStrings>('catalog')

  if (videos.length === 0) return <ContentEmpty description={s.emptyVideos} />

  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {videos.map((video) => {
        const locked = !hasSubscription && !video.is_free_preview
        const duration = formatDuration(video.duration_seconds)
        const meta = (
          <>
            <span className="text-foreground block text-sm font-medium">{video.title}</span>
            <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{s.videoTypes[video.type]}</Badge>
              {video.is_free_preview ? <Badge variant="success">{s.freePreview}</Badge> : null}
              <span className="tabular-nums">{duration}</span>
            </span>
          </>
        )

        return (
          <li key={video.id}>
            {locked ? (
              <div className="flex items-center gap-3 px-3 py-3 opacity-70">
                <Lock aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
                <span className="min-w-0 flex-1">{meta}</span>
                <Badge variant="outline" className="shrink-0">
                  {s.locked}
                </Badge>
              </div>
            ) : (
              <Link
                href={`/video/${video.id}`}
                className="hover:bg-muted/60 focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <PlayCircle aria-hidden="true" className="text-primary size-5 shrink-0" />
                <span className="min-w-0 flex-1">{meta}</span>
                <span className="sr-only">{s.watchVideo}</span>
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
