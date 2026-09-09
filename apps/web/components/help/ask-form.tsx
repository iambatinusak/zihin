'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Input } from '@zihin/ui/input'
import { Textarea } from '@zihin/ui/textarea'
import { Field, FormErrorSummary, SubmitButton } from '@/components/common/form-parts'
import { askQuestion } from '@/app/(student)/soru-sor/actions'
import { formatBytes, isAllowedImageSize, isAllowedImageType } from '@/lib/help/image'
import { resizeImageFile } from '@/lib/help/resize-image'
import { buildHelpUploadKey, HELP_UPLOADS_BUCKET } from '@/lib/help/storage'
import { LiveRegion } from '@/components/common/live-region'
import { fill } from '@/lib/i18n/core'
import { helpStrings } from './strings'

/**
 * Soru sorma formu (spec §M11, ekran §9.13).
 *
 * FOTOĞRAF AKIŞI: dosya önce TARAYICIDA küçültülür (en uzun kenar 1600 px,
 * JPEG 0.85), sonra doğrudan `help-uploads` kovasına yüklenir ve action'a
 * yalnızca NESNE ANAHTARI gider. Küçültme bir kolaylıktır — tür ve boyut
 * sunucuda nesnenin kendi meta verisinden yeniden doğrulanır; buradaki
 * denetimler sadece kullanıcıya erken ve anlaşılır geri bildirim içindir.
 *
 * Nesne anahtarı `<user_id>/<ad>.<uzantı>` biçimindedir; başka bir düzen
 * 0012_storage.sql'deki RLS politikasına takılır (bkz. lib/help/storage.ts).
 */

export type AskFormSubject = { id: string; name: string }
export type AskFormTopic = { id: string; title: string; subjectId: string; unitName: string }

type AskFormProps = {
  userId: string
  subjects: AskFormSubject[]
  topics: AskFormTopic[]
  /** Bugün kalan soru hakkı; 0 ise form kilitlidir. */
  remaining: number
}

export function AskForm({ userId, subjects, topics, remaining }: AskFormProps) {
  const s = helpStrings()
  const router = useRouter()

  const [subjectId, setSubjectId] = React.useState('')
  const [topicId, setTopicId] = React.useState('')
  const [body, setBody] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [preparing, setPreparing] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const quotaReached = remaining <= 0
  const topicsForSubject = topics.filter((topic) => topic.subjectId === subjectId)

  function resetFile() {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    if (!selected) {
      resetFile()
      return
    }

    if (!isAllowedImageType(selected.type)) {
      resetFile()
      toast.error(s.imageWrongType)
      return
    }

    setPreparing(true)
    const { file: prepared, resized } = await resizeImageFile(selected)
    setPreparing(false)

    // Küçültmeden SONRA hâlâ büyükse kullanıcıya burada söyleriz; sunucu da
    // aynı sınırı bağımsız olarak uygular.
    if (!isAllowedImageSize(prepared.size)) {
      resetFile()
      toast.error(fill(s.imageTooLarge, { size: formatBytes(prepared.size) }))
      return
    }

    setFile(prepared)
    if (resized) toast.success(fill(s.imageResized, { size: formatBytes(prepared.size) }))
  }

  /** Dosyayı kovaya yükler ve nesne anahtarını döner. */
  async function uploadImage(selected: File): Promise<string> {
    const unique = crypto.randomUUID().replace(/-/g, '')
    const key = buildHelpUploadKey(userId, { unique, type: selected.type })

    // Görsel isteğe bağlı; yüklemeye kadar `@supabase/supabase-js` (~189 kB)
    // indirilmez. Statik import olsaydı görselsiz soru soran herkes de indirirdi.
    const { getBrowserClient } = await import('@/lib/supabase/client')

    const { error } = await getBrowserClient()
      .storage.from(HELP_UPLOADS_BUCKET)
      .upload(key, selected, { contentType: selected.type, upsert: false })

    if (error) throw new Error(error.message)
    return key
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || preparing || quotaReached) return

    setFormError(null)
    setFieldErrors({})

    if (!subjectId) {
      setFieldErrors({ subjectId: [s.subjectRequired] })
      return
    }
    if (body.trim().length === 0 && !file) {
      setFieldErrors({ body: [s.emptyRequest] })
      return
    }

    setPending(true)
    try {
      let imageKey: string | null = null
      if (file) {
        try {
          imageKey = await uploadImage(file)
        } catch (error) {
          console.error('[help] fotoğraf yüklenemedi:', error)
          setPending(false)
          setFormError(s.imageUploadFailed)
          return
        }
      }

      const result = await askQuestion({
        subjectId,
        topicId: topicId || null,
        body: body.trim() || undefined,
        imageKey,
      })

      if (!result.ok) {
        setPending(false)
        setFormError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }

      // Ayrıntı sayfasında benzer sorular, yazışma ve durum sunucuda basılır;
      // soru metni markdown olabildiği için render orada olmalı.
      router.push(`/soru-sor/${result.data.requestId}`)
    } catch (error) {
      console.error('[help] soru gönderilemedi:', error)
      setPending(false)
      setFormError(s.submitFailed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FormErrorSummary message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="soru-ders" label={s.subjectLabel} error={fieldErrors.subjectId}>
          {(aria) => (
            <select
              {...aria}
              name="subjectId"
              value={subjectId}
              disabled={quotaReached}
              onChange={(event) => {
                setSubjectId(event.target.value)
                setTopicId('')
              }}
              className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <option value="">{s.subjectPlaceholder}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field id="soru-konu" label={s.topicLabel} error={fieldErrors.topicId}>
          {(aria) => (
            <select
              {...aria}
              name="topicId"
              value={topicId}
              disabled={quotaReached || topicsForSubject.length === 0}
              onChange={(event) => setTopicId(event.target.value)}
              className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <option value="">{s.topicAll}</option>
              {topicsForSubject.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {`${topic.unitName} · ${topic.title}`}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field id="soru-metin" label={s.bodyLabel} hint={s.bodyHint} error={fieldErrors.body}>
        {(aria) => (
          <Textarea
            {...aria}
            name="body"
            rows={5}
            value={body}
            disabled={quotaReached}
            placeholder={s.bodyPlaceholder}
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </Field>

      <Field id="soru-foto" label={s.imageLabel} hint={s.imageHint} error={fieldErrors.imageKey}>
        {(aria) => (
          <Input
            {...aria}
            ref={fileInputRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp,image/heic"
            disabled={quotaReached || pending}
            onChange={(event) => void handleFileChange(event)}
          />
        )}
      </Field>

      <LiveRegion message={preparing ? s.submitting : ''} />
      {preparing ? (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          {s.submitting}
        </p>
      ) : null}

      {file ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>{fill(s.imageSelected, { name: file.name, size: formatBytes(file.size) })}</span>
          <Button type="button" variant="ghost" size="sm" onClick={resetFile}>
            <X aria-hidden="true" className="size-3.5" />
            {s.imageRemove}
          </Button>
        </div>
      ) : null}

      <p className="text-muted-foreground text-xs">
        {quotaReached ? s.quotaExhausted : fill(s.quotaRemaining, { remaining })}
      </p>

      {/* Kota dolduğunda düğme hiç basılmaz. Bu bir DENETİM DEĞİLDİR: action
          kotayı kendi sayar (bkz. app/(student)/soru-sor/actions.ts). */}
      {quotaReached ? null : (
        <SubmitButton pending={pending || preparing} label={s.submit} pendingLabel={s.submitting} />
      )}
    </form>
  )
}
