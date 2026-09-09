'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@zihin/ui/card'
import { Input } from '@zihin/ui/input'
import { Label } from '@zihin/ui/label'
import { Switch } from '@zihin/ui/switch'
import {
  Field,
  FormErrorSummary,
  FormSuccess,
  SubmitButton,
  SwitchRow,
  type FieldErrors,
} from '@/components/common/form-parts'
import { LiveRegion } from '@/components/common/live-region'
import { fill, t } from '@/lib/i18n/admin-media'
import {
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  VIDEOS_BUCKET,
  buildVideoStorageKey,
  extensionForVideoType,
} from '@/lib/media/storage'
import { createVideo, updateVideo } from '@/app/(admin)/admin/videolar/actions'
import type { AdminVideo } from '@/lib/data/admin-media'

/**
 * Video oluşturma/düzenleme formu.
 *
 * ── YÜKLEME ────────────────────────────────────────────────────────────────
 * Dosya doğrudan tarayıcıdan `videos` kovasına gider. `0012_storage.sql`
 * içindeki `videos_insert_editor` politikası yazmayı `public.is_editor()` ile
 * sınırlar; yani yükleme yetkisi de veritabanında denetlenir. Dosyayı önce
 * sunucuya taşımak (Server Action gövde sınırı ~1 MB) zaten mümkün değildi.
 *
 * `lib/video/` altındaki `VideoProvider` soyutlaması OYNATMA (imzalı bağlantı)
 * içindir, yükleme için değil — o yüzden burada ikinci bir "provider" yazılmaz,
 * yalnızca satıra `storage_path` kaydedilir ve oynatmayı yine o soyutlama
 * yapar.
 */

type VideoFormProps = {
  topicId: string
  /** Düzenleme modunda mevcut satır; yeni kayıtta null. */
  video: AdminVideo | null
  /** Yeni kayıt için önerilen sıra numarası. */
  nextOrderIndex: number
}

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px]'

export function VideoForm({ topicId, video, nextOrderIndex }: VideoFormProps) {
  const router = useRouter()
  const isEdit = video !== null

  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [success, setSuccess] = React.useState(false)

  const [provider, setProvider] = React.useState<'supabase' | 'bunny'>(
    video?.provider ?? 'supabase',
  )
  const [storagePath, setStoragePath] = React.useState(video?.storage_path ?? '')
  const [uploading, setUploading] = React.useState(false)
  const [isFreePreview, setIsFreePreview] = React.useState(video?.is_free_preview ?? false)
  const [isPublished, setIsPublished] = React.useState(video?.is_published ?? false)

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!extensionForVideoType(file.type)) {
      setFieldErrors({ storagePath: [t('adminMedia.videoUploadWrongType')] })
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setFieldErrors({ storagePath: [t('adminMedia.videoUploadTooLarge')] })
      return
    }

    setFieldErrors({})
    setUploading(true)
    try {
      const key = buildVideoStorageKey(topicId, crypto.randomUUID().replace(/-/g, ''), file.type)
      // Dosya yükleme isteğe bağlı; tarayıcı istemcisi (~189 kB) o ana kadar
      // indirilmez.
      const { getBrowserClient } = await import('@/lib/supabase/client')

      const { error: uploadError } = await getBrowserClient()
        .storage.from(VIDEOS_BUCKET)
        .upload(key, file, { contentType: file.type, upsert: false })

      if (uploadError) throw new Error(uploadError.message)
      setStoragePath(key)
    } catch (uploadError) {
      console.error('[admin-media] video yüklenemedi:', uploadError)
      setFieldErrors({ storagePath: [t('adminMedia.videoUploadFailed')] })
    } finally {
      setUploading(false)
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    setError(null)
    setFieldErrors({})
    setSuccess(false)

    const payload = {
      topicId,
      title: String(data.get('title') ?? ''),
      type: String(data.get('type') ?? 'lecture'),
      provider,
      providerVideoId: String(data.get('providerVideoId') ?? ''),
      storagePath,
      thumbnailUrl: String(data.get('thumbnailUrl') ?? ''),
      durationSeconds: String(data.get('durationSeconds') ?? '0'),
      orderIndex: String(data.get('orderIndex') ?? '0'),
      isFreePreview,
      isPublished,
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateVideo({ ...payload, id: video.id })
        : await createVideo(payload)

      if (!result.ok) {
        setError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }

      setSuccess(true)
      router.refresh()
      if (!isEdit) router.push(`/admin/videolar/${result.data.id}`)
    })
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={error} />

          <Field id="title" label={t('adminMedia.videoTitle')} error={fieldErrors.title}>
            {(aria) => <Input {...aria} name="title" required defaultValue={video?.title ?? ''} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="type" label={t('adminMedia.videoType')} error={fieldErrors.type}>
              {(aria) => (
                <select
                  {...aria}
                  name="type"
                  className={SELECT_CLASS}
                  defaultValue={video?.type ?? 'lecture'}
                >
                  <option value="lecture">{t('adminMedia.videoTypeLecture')}</option>
                  <option value="solution">{t('adminMedia.videoTypeSolution')}</option>
                  <option value="summary">{t('adminMedia.videoTypeSummary')}</option>
                </select>
              )}
            </Field>

            <Field id="provider" label={t('adminMedia.videoProvider')} error={fieldErrors.provider}>
              {(aria) => (
                <select
                  {...aria}
                  name="provider"
                  className={SELECT_CLASS}
                  value={provider}
                  onChange={(event) =>
                    setProvider(event.target.value === 'bunny' ? 'bunny' : 'supabase')
                  }
                >
                  <option value="supabase">{t('adminMedia.videoProviderSupabase')}</option>
                  <option value="bunny">{t('adminMedia.videoProviderBunny')}</option>
                </select>
              )}
            </Field>
          </div>

          {provider === 'bunny' ? (
            <Field
              id="providerVideoId"
              label={t('adminMedia.videoProviderVideoId')}
              hint={t('adminMedia.videoProviderVideoIdHint')}
              error={fieldErrors.providerVideoId}
            >
              {(aria) => (
                <Input
                  {...aria}
                  name="providerVideoId"
                  defaultValue={video?.provider_video_id ?? ''}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              )}
            </Field>
          ) : (
            // Dosya alanı `Field` kullanmaz: etiketin gerçek bir <input> ile
            // eşleşmesi gerekiyor, sarmalayıcı bir <div> ile değil.
            <div className="space-y-1.5">
              <Label htmlFor="video-dosya">{t('adminMedia.videoStoragePath')}</Label>
              <input
                id="video-dosya"
                type="file"
                accept={ACCEPTED_VIDEO_TYPES.join(',')}
                aria-describedby="video-dosya-aciklama"
                aria-invalid={fieldErrors.storagePath ? true : undefined}
                disabled={uploading}
                onChange={handleFile}
                className="text-muted-foreground file:bg-secondary file:text-secondary-foreground block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
              />
              <p id="video-dosya-aciklama" className="text-muted-foreground text-xs">
                {t('adminMedia.videoStoragePathHint')}
              </p>
              <LiveRegion message={uploading ? t('adminMedia.saving') : ''} />
              {uploading ? (
                <p className="text-muted-foreground text-xs">{t('adminMedia.saving')}</p>
              ) : null}
              {storagePath === '' ? null : (
                <p className="text-muted-foreground break-all text-xs">
                  {fill(t('adminMedia.videoUploaded'), { path: storagePath })}
                </p>
              )}
              {fieldErrors.storagePath?.[0] ? (
                <p role="alert" className="text-destructive text-xs font-medium">
                  {fieldErrors.storagePath[0]}
                </p>
              ) : null}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="durationSeconds"
              label={t('adminMedia.videoDuration')}
              hint={t('adminMedia.videoDurationHint')}
              error={fieldErrors.durationSeconds}
            >
              {(aria) => (
                <Input
                  {...aria}
                  name="durationSeconds"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={video?.duration_seconds ?? 0}
                />
              )}
            </Field>

            <Field
              id="orderIndex"
              label={t('adminMedia.videoOrder')}
              error={fieldErrors.orderIndex}
            >
              {(aria) => (
                <Input
                  {...aria}
                  name="orderIndex"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={video?.order_index ?? nextOrderIndex}
                />
              )}
            </Field>
          </div>

          <Field
            id="thumbnailUrl"
            label={t('adminMedia.videoThumbnail')}
            error={fieldErrors.thumbnailUrl}
          >
            {(aria) => (
              <Input {...aria} name="thumbnailUrl" defaultValue={video?.thumbnail_url ?? ''} />
            )}
          </Field>

          <div>
            <SwitchRow
              id="isFreePreview"
              label={t('adminMedia.videoFreePreview')}
              hint={t('adminMedia.videoFreePreviewHint')}
            >
              {(aria) => (
                <Switch {...aria} checked={isFreePreview} onCheckedChange={setIsFreePreview} />
              )}
            </SwitchRow>
            <SwitchRow
              id="isPublished"
              label={t('adminMedia.videoPublished')}
              hint={t('adminMedia.videoPublishedHint')}
            >
              {(aria) => (
                <Switch {...aria} checked={isPublished} onCheckedChange={setIsPublished} />
              )}
            </SwitchRow>
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton
              pending={pending || uploading}
              label={isEdit ? t('adminMedia.save') : t('adminMedia.create')}
              pendingLabel={isEdit ? t('adminMedia.saving') : t('adminMedia.creating')}
            />
            <FormSuccess show={success} message={t('adminMedia.saved')} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
