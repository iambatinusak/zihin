'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Badge } from '@zihin/ui/badge'
import { Button } from '@zihin/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import { t } from '@/lib/i18n/admin-media'
import { formatTimestamp } from '@/lib/media/checkpoint'
import { deleteVideo, setVideoPublished } from '@/app/(admin)/admin/videolar/actions'
import type { AdminVideo } from '@/lib/data/admin-media'

/** Konunun videoları; yayın durumu ve silme buradan yönetilir. */
export function VideoList({ videos }: { videos: AdminVideo[] }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function run(operation: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setError(null)
    startTransition(async () => {
      const result = await operation()
      if (!result.ok) {
        setError(result.error?.message ?? null)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      ) : null}

      <div className="border-border rounded-lg border" aria-busy={pending}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('adminMedia.videoTitle')}</TableHead>
              <TableHead>{t('adminMedia.videoType')}</TableHead>
              <TableHead>{t('adminMedia.videoDuration')}</TableHead>
              <TableHead>{t('adminMedia.videoOrder')}</TableHead>
              <TableHead>{t('adminMedia.published')}</TableHead>
              <TableHead className="text-right">{t('adminMedia.edit')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videos.map((video) => (
              <TableRow key={video.id}>
                <TableCell className="font-medium">
                  <Link className="hover:underline" href={`/admin/videolar/${video.id}`}>
                    {video.title}
                  </Link>
                  {video.is_free_preview ? (
                    <Badge variant="secondary" className="ml-2">
                      {t('adminMedia.videoFreePreview')}
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{typeLabel(video.type)}</TableCell>
                <TableCell>{formatTimestamp(video.duration_seconds)}</TableCell>
                <TableCell>{video.order_index}</TableCell>
                <TableCell>
                  <Badge variant={video.is_published ? 'default' : 'outline'}>
                    {video.is_published ? t('adminMedia.published') : t('adminMedia.draft')}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        setVideoPublished({ id: video.id, isPublished: !video.is_published }),
                      )
                    }
                  >
                    {video.is_published ? t('adminMedia.unpublish') : t('adminMedia.publish')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(t('adminMedia.deleteConfirm'))) return
                      run(() => deleteVideo({ id: video.id }))
                    }}
                  >
                    {t('adminMedia.delete')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function typeLabel(type: AdminVideo['type']): string {
  if (type === 'solution') return t('adminMedia.videoTypeSolution')
  if (type === 'summary') return t('adminMedia.videoTypeSummary')
  return t('adminMedia.videoTypeLecture')
}
