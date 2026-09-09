'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Layers, Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { addWrongAnswersToCards } from '@/app/(student)/kartlar/actions'
import { fill, section } from '@/lib/i18n/test'
import type { CardStrings } from '@/components/cards/strings'
import type { TestStrings } from './strings'

/**
 * "Yanlışlarımı karta ekle" (spec §M9).
 *
 * Kartlar `finishTest` sırasında zaten otomatik üretilir; bu düğme öğrencinin
 * elle tetiklemesi ve KAÇ kart eklendiğini görmesi içindir. İkinci kez basmak
 * yeni kart açmaz: `(created_by, source_question_id)` kısmi tekil indeksi
 * yinelenmeyi engeller, sunucu 0 üretilmiş kart döner ve kullanıcıya bu
 * söylenir — "eklendi" deyip hiçbir şey yapmayan bir düğme olmaz.
 */
export function AddWrongToCardsButton({
  sessionId,
  wrongCount,
}: {
  sessionId: string
  wrongCount: number
}) {
  const s = section<TestStrings>('test')
  const c = section<CardStrings>('cards')
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function add() {
    if (pending) return
    setPending(true)
    try {
      const result = await addWrongAnswersToCards({ sessionId })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      if (result.data.created > 0) {
        toast.success(fill(c.addWrongSuccess, { count: result.data.created }))
        router.refresh()
      } else {
        toast.info(c.addWrongNone)
      }
    } catch {
      toast.error(c.addWrongFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending || wrongCount === 0}
      aria-busy={pending}
      title={s.result.addWrongToCardsHint}
      onClick={() => void add()}
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Layers aria-hidden="true" className="size-4" />
      )}
      {pending ? c.addWrongPending : s.result.addWrongToCards}
      {wrongCount > 0 ? <span className="tabular-nums">{`(${wrongCount})`}</span> : null}
    </Button>
  )
}
