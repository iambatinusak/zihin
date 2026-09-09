'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@zihin/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { acceptSimilarQuestion, dismissSimilarQuestions } from '@/app/(student)/soru-sor/actions'
import { fill } from '@/lib/i18n/core'
import { helpStrings } from './strings'

/**
 * "Bu sorulardan biri mi?" adımı (spec §M11).
 *
 * Modülün asıl kazancı burada: öğrenci bankadaki eşi bulunca soru öğretmene
 * hiç gitmez. Soru kökü SUNUCUDA markdown olarak basılıp `ReactNode` olarak
 * geçirilir — react-markdown ve KaTeX istemci paketine girmez (CONVENTIONS).
 */

export type SimilarMatchItem = {
  questionId: string
  /** Sunucuda basılmış soru kökü. */
  stem: React.ReactNode
  /** Konunun müfredattaki adresi; yoksa bağlantı gösterilmez. */
  topicHref: string | null
  topicTitle: string | null
  /** 0-1 arası benzerlik; bilinmiyorsa null (puan gösterilmez). */
  similarity: number | null
}

export function SimilarMatches({
  requestId,
  matches,
}: {
  requestId: string
  matches: SimilarMatchItem[]
}) {
  const s = helpStrings()
  const router = useRouter()
  const [pending, setPending] = React.useState<string | null>(null)

  if (matches.length === 0) return null

  async function accept(questionId: string) {
    if (pending) return
    setPending(questionId)
    const result = await acceptSimilarQuestion({ requestId, questionId })
    setPending(null)

    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success(s.similarAccepted)
    router.refresh()
  }

  async function reject() {
    if (pending) return
    setPending('reject')
    const result = await dismissSimilarQuestions({ requestId })
    setPending(null)

    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success(s.similarSent)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{s.similarTitle}</CardTitle>
        <CardDescription>{s.similarBody}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {matches.map((match) => (
            <li key={match.questionId} className="border-border rounded-lg border p-3">
              <div className="text-sm">{match.stem}</div>
              <p className="text-muted-foreground mt-2 text-xs">
                {[
                  match.similarity === null
                    ? null
                    : fill(s.similarScore, { score: Math.round(match.similarity * 100) }),
                  match.topicTitle,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {match.topicHref ? (
                  <Link
                    href={match.topicHref}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    {s.similarOpen}
                  </Link>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={pending !== null}
                  aria-busy={pending === match.questionId}
                  onClick={() => void accept(match.questionId)}
                >
                  {s.similarAccept}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          disabled={pending !== null}
          aria-busy={pending === 'reject'}
          onClick={() => void reject()}
        >
          {s.similarReject}
        </Button>
      </CardContent>
    </Card>
  )
}
