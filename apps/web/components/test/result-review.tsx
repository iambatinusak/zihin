'use client'

import * as React from 'react'
import { CheckCircle2, Circle, PlayCircle, XCircle } from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import { Button, buttonVariants } from '@zihin/ui/button'
import { cn } from '@zihin/ui/lib/utils'
import { section, t } from '@/lib/i18n/test'
import { fill } from '@/lib/i18n/test'
import type { TestStrings } from './strings'
import { filterReview, type ReviewFilter } from './result-state'
import { BookmarkButton } from './bookmark-button'

/**
 * Soru soru çözüm incelemesi (spec §9.9).
 *
 * Metinler (kök, şıklar, açıklama) SUNUCUDA basılmış düğümler olarak gelir;
 * Markdown + KaTeX yığını istemci paketine girmez. Burada yalnızca süzgeç,
 * işaretleme ve görsel işaretleme yapılır.
 */

export type ReviewOption = { key: string; label: React.ReactNode }

export type ReviewItem = {
  questionId: string
  stem: React.ReactNode
  imageUrl: string | null
  options: ReviewOption[]
  selectedOption: string | null
  correctOption: string
  isCorrect: boolean
  explanation: React.ReactNode | null
  solutionVideoUrl: string | null
  bookmarked: boolean
}

export function ResultReview({ items }: { items: ReviewItem[] }) {
  const s = section<TestStrings>('test')
  const [filter, setFilter] = React.useState<ReviewFilter>('all')

  // Süzgeç sonrası da ASIL soru numarası gösterilir; "3. soru" testteki yerdir,
  // süzgeçteki sırası değil.
  const numbered = React.useMemo(
    () => items.map((item, index) => ({ ...item, number: index + 1 })),
    [items],
  )
  const visible = filterReview(numbered, filter)

  const filters: Array<{ value: ReviewFilter; label: string }> = [
    { value: 'all', label: s.result.filterAll },
    { value: 'wrong', label: s.result.filterWrong },
    { value: 'blank', label: s.result.filterBlank },
  ]

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground text-base font-semibold">{s.result.reviewTitle}</h2>
        <div role="group" aria-label={s.result.filterAll} className="flex flex-wrap gap-2">
          {filters.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? 'default' : 'outline'}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          {s.result.reviewEmpty}
        </p>
      ) : (
        <ol className="space-y-4">
          {visible.map((item) => (
            <li key={item.questionId}>
              <ReviewCard item={item} strings={s} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function ReviewCard({
  item,
  strings,
}: {
  item: ReviewItem & { number: number }
  strings: TestStrings
}) {
  const blank = item.selectedOption === null
  const status = blank ? 'blank' : item.isCorrect ? 'correct' : 'wrong'

  return (
    <article className="border-border space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm font-medium tabular-nums">
            {fill(strings.result.questionIndex, { index: item.number })}
          </span>
          <StatusBadge status={status} strings={strings} />
        </div>
        <BookmarkButton questionId={item.questionId} initialBookmarked={item.bookmarked} />
      </div>

      {item.stem}
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={strings.runner.questionImage}
          className="h-auto max-w-full rounded-md"
        />
      ) : null}

      <ul className="space-y-2">
        {item.options.map((option) => {
          const isCorrect = option.key === item.correctOption
          const isSelected = option.key === item.selectedOption
          return (
            <li
              key={option.key}
              className={cn(
                'flex items-start gap-3 rounded-md border px-3 py-2 text-sm',
                isCorrect && 'border-mastery-strong bg-mastery-strong/10',
                isSelected && !isCorrect && 'border-mastery-weak bg-mastery-weak/10',
                !isCorrect && !isSelected && 'border-border',
              )}
            >
              <span
                aria-hidden="true"
                className="border-border flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
              >
                {option.key}
              </span>
              <span className="min-w-0 flex-1">{option.label}</span>
              {/* Renk tek başına anlam taşımaz: her işaretin metin karşılığı var. */}
              {isCorrect ? (
                <span className="text-mastery-strong shrink-0 text-xs font-medium">
                  {strings.result.correctAnswer}
                </span>
              ) : null}
              {isSelected && !isCorrect ? (
                <span className="text-mastery-weak shrink-0 text-xs font-medium">
                  {strings.result.yourAnswer}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="bg-muted/40 rounded-md p-3">
        <p className="text-foreground text-xs font-semibold">{strings.result.explanation}</p>
        {item.explanation ?? (
          <p className="text-muted-foreground mt-1 text-sm">{strings.result.noExplanation}</p>
        )}
      </div>

      {item.solutionVideoUrl ? (
        <a
          href={item.solutionVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <PlayCircle aria-hidden="true" className="size-4" />
          {strings.result.solutionVideo}
          <span className="sr-only">{t('common.opensInNewTab')}</span>
        </a>
      ) : null}
    </article>
  )
}

function StatusBadge({
  status,
  strings,
}: {
  status: 'correct' | 'wrong' | 'blank'
  strings: TestStrings
}) {
  if (status === 'correct') {
    return (
      <Badge variant="outline" className="border-mastery-strong text-mastery-strong gap-1">
        <CheckCircle2 aria-hidden="true" className="size-3.5" />
        {strings.result.correctBadge}
      </Badge>
    )
  }
  if (status === 'wrong') {
    return (
      <Badge variant="outline" className="border-mastery-weak text-mastery-weak gap-1">
        <XCircle aria-hidden="true" className="size-3.5" />
        {strings.result.wrongBadge}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <Circle aria-hidden="true" className="size-3.5" />
      {strings.result.blankBadge}
    </Badge>
  )
}
