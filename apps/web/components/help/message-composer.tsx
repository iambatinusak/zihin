'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@zihin/ui/button'
import { Textarea } from '@zihin/ui/textarea'
import { Field, SubmitButton } from '@/components/common/form-parts'
import { closeHelpRequest, sendHelpMessage } from '@/app/(student)/soru-sor/actions'
import { MAX_MESSAGES_PER_REQUEST } from '@/lib/help/db-errors'
import { LiveRegion } from '@/components/common/live-region'
import { fill } from '@/lib/i18n/core'
import { helpStrings } from './strings'

/**
 * Öğrencinin mesaj kutusu.
 *
 * 5 mesaj sınırına ulaşıldığında kutu HİÇ basılmaz ve sebebi yazılır. Bu bir
 * denetim değil, nezakettir: sınırı veritabanı trigger'ı (0007) zorluyor ve
 * action da önden sayıyor.
 */
export function MessageComposer({
  requestId,
  messageCount,
  closed,
}: {
  requestId: string
  messageCount: number
  closed: boolean
}) {
  const s = helpStrings()
  const router = useRouter()
  const [body, setBody] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [closing, setClosing] = React.useState(false)

  const remaining = Math.max(0, MAX_MESSAGES_PER_REQUEST - messageCount)
  const limitReached = remaining === 0

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || body.trim().length === 0) return

    setPending(true)
    const result = await sendHelpMessage({ requestId, body: body.trim() })
    setPending(false)

    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setBody('')
    router.refresh()
  }

  async function close() {
    if (closing) return
    setClosing(true)
    const result = await closeHelpRequest({ requestId })
    setClosing(false)

    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success(s.closeRequestDone)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <LiveRegion message={!closed && limitReached ? s.messageLimitReached : ''} />
      {closed ? null : limitReached ? (
        <p className="text-muted-foreground text-sm">{s.messageLimitReached}</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field
            id="mesaj-metin"
            label={s.messageSend}
            hint={fill(s.messageLimitHint, { max: MAX_MESSAGES_PER_REQUEST, remaining })}
          >
            {(aria) => (
              <Textarea
                {...aria}
                rows={3}
                value={body}
                placeholder={s.messagePlaceholder}
                onChange={(event) => setBody(event.target.value)}
              />
            )}
          </Field>
          <SubmitButton pending={pending} label={s.messageSend} pendingLabel={s.messageSending} />
        </form>
      )}

      {closed ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={closing}
          aria-busy={closing}
          onClick={() => void close()}
        >
          {s.closeRequest}
        </Button>
      )}
    </div>
  )
}
