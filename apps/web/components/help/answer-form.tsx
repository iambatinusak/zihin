'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@zihin/ui/input'
import { Textarea } from '@zihin/ui/textarea'
import { Field, FormErrorSummary, SubmitButton } from '@/components/common/form-parts'
import { answerHelpRequest } from '@/app/(teacher)/ogretmen/actions'
import { helpStrings } from './strings'

/**
 * Öğretmenin yanıt formu (spec §M11).
 *
 * Yanıt markdown + LaTeX olarak yazılır ve öğrenciye paylaşılan işleyiciyle
 * SUNUCUDA basılır; bu bileşen yalnızca ham metni toplar. Görsel ve video
 * bağlantısı isteğe bağlıdır ve yalnızca `https` kabul edilir (bkz.
 * app/(teacher)/ogretmen/schemas.ts).
 */
export function AnswerForm({ requestId }: { requestId: string }) {
  const s = helpStrings()
  const router = useRouter()

  const [body, setBody] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [videoUrl, setVideoUrl] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>({})

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setFormError(null)
    setFieldErrors({})

    if (body.trim().length === 0) {
      setFieldErrors({ body: [s.teacherAnswerEmpty] })
      return
    }

    setPending(true)
    const result = await answerHelpRequest({
      requestId,
      body: body.trim(),
      imageUrl: imageUrl.trim() || null,
      videoUrl: videoUrl.trim() || null,
    })
    setPending(false)

    if (!result.ok) {
      setFormError(result.error.message)
      setFieldErrors(result.error.fieldErrors ?? {})
      return
    }

    setBody('')
    setImageUrl('')
    setVideoUrl('')
    toast.success(s.teacherAnswerSent)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormErrorSummary message={formError} />

      <Field
        id="yanit-metin"
        label={s.teacherAnswerLabel}
        hint={s.teacherAnswerHint}
        error={fieldErrors.body}
      >
        {(aria) => (
          <Textarea
            {...aria}
            rows={8}
            value={body}
            placeholder={s.teacherAnswerPlaceholder}
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="yanit-gorsel" label={s.teacherAnswerImageLabel} error={fieldErrors.imageUrl}>
          {(aria) => (
            <Input
              {...aria}
              type="url"
              inputMode="url"
              value={imageUrl}
              placeholder="https://"
              onChange={(event) => setImageUrl(event.target.value)}
            />
          )}
        </Field>

        <Field id="yanit-video" label={s.teacherAnswerVideoLabel} error={fieldErrors.videoUrl}>
          {(aria) => (
            <Input
              {...aria}
              type="url"
              inputMode="url"
              value={videoUrl}
              placeholder="https://"
              onChange={(event) => setVideoUrl(event.target.value)}
            />
          )}
        </Field>
      </div>

      <SubmitButton
        pending={pending}
        label={s.teacherAnswerSubmit}
        pendingLabel={s.teacherAnswerSubmitting}
      />
    </form>
  )
}
