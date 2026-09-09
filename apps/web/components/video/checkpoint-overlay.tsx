'use client'

import * as React from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { cn } from '@zihin/ui/lib/utils'
import dynamic from 'next/dynamic'
import { answerCheckpoint } from '@/app/(student)/video/actions'
import { formatClock } from './format'
import { LiveRegion } from '@/components/common/live-region'
import { fill } from '@/lib/i18n/core'
import { parseOptions } from '@/lib/questions/options'
import type { VideoStrings } from './strings'

/**
 * Markdown yığını (react-markdown + KaTeX + rehype-sanitize) TEMBEL yüklenir.
 *
 * Sebep: bu bir istemci bileşeni. Doğrudan içe aktarıldığında bütün yığın
 * /video/[id] sayfasının ilk paketine giriyordu — oysa kullanıcıların çoğu
 * hiç checkpoint görmeden videoyu bitirir. `next/dynamic` ile yığın yalnızca
 * bir soru gerçekten açıldığında indirilir. Test tarafı aynı sorunu soruları
 * sunucuda basarak çözüyor; burada metin (açıklama) çalışma anında geldiği
 * için sunucuda basmak mümkün değil, tembel yükleme doğru karşılığı.
 */
const Markdown = dynamic(
  () => import('@/components/common/markdown').then((module) => module.Markdown),
  { ssr: false },
)

/**
 * Videonun üstüne binen kontrol sorusu (spec §M4).
 *
 * Doğru cevap istemciye ÖNCEDEN gelmez: `answerCheckpoint` sunucuda
 * değerlendirir ve doğru şıkkı yalnızca cevap verildikten sonra döner.
 * Atlanan soru için action hiç çağrılmaz — "atlanan = cevaplanmadı".
 */

export type OverlayCheckpoint = {
  id: string
  timestampSeconds: number
  question: {
    id: string
    stem: string
    options: unknown
    imageUrl: string | null
  }
}

type CheckpointOverlayProps = {
  checkpoint: OverlayCheckpoint
  strings: VideoStrings
  /** Soru kapandığında oynatıcı devam eder. */
  onResume: () => void
}

type Outcome = {
  isCorrect: boolean
  correctOption: string
  explanation: string | null
}

export function CheckpointOverlay({ checkpoint, strings, onResume }: CheckpointOverlayProps) {
  const options = React.useMemo(
    () => parseOptions(checkpoint.question.options),
    [checkpoint.question.options],
  )

  const [selected, setSelected] = React.useState<string | null>(null)
  const [outcome, setOutcome] = React.useState<Outcome | null>(null)
  const [skipped, setSkipped] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const openedAtRef = React.useRef(Date.now())
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const headingId = `checkpoint-${checkpoint.id}-baslik`

  // Soru açıldığında odak panele taşınır; klavye kullanıcısı oynatıcı
  // düğmelerinde kaybolmasın.
  React.useEffect(() => {
    openedAtRef.current = Date.now()
    panelRef.current?.focus()
  }, [checkpoint.id])

  async function handleAnswer() {
    if (!selected || pending) return
    setPending(true)
    setErrorMessage(null)

    const result = await answerCheckpoint({
      checkpointId: checkpoint.id,
      selectedOption: selected,
      timeSpentMs: Math.min(10 * 60 * 1000, Math.max(0, Date.now() - openedAtRef.current)),
    })

    setPending(false)
    if (!result.ok) {
      setErrorMessage(result.error.message)
      return
    }
    setOutcome(result.data)
  }

  const answered = outcome !== null || skipped
  const correctOptionText = outcome
    ? (options.find((option) => option.key === outcome.correctOption)?.text ?? '')
    : ''

  return (
    <div
      // Oynatıcı kabının içinde konumlanır; sayfa kaydırmasını etkilemez.
      className="bg-background/95 absolute inset-0 z-20 flex items-start justify-center overflow-y-auto p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="border-border bg-card w-full max-w-xl rounded-lg border p-4 shadow-lg focus:outline-none sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={headingId} className="text-foreground text-base font-semibold">
            {strings.checkpointTitle}
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatClock(checkpoint.timestampSeconds)}
          </span>
        </div>

        <p className="text-muted-foreground mb-3 text-sm">{strings.checkpointHint}</p>

        <Markdown content={checkpoint.question.stem} className="mb-4" />

        {checkpoint.question.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={checkpoint.question.imageUrl}
            alt={strings.checkpointImage}
            className="border-border mb-4 h-auto max-w-full rounded-md border"
          />
        ) : null}

        {options.length > 0 ? (
          <fieldset className="mb-4" disabled={answered || pending}>
            <legend className="sr-only">{strings.checkpointTitle}</legend>
            <ul className="space-y-2">
              {options.map((option) => {
                const isChosen = selected === option.key
                const isRightAnswer = outcome !== null && outcome.correctOption === option.key
                const isWrongChoice = outcome !== null && isChosen && !outcome.isCorrect

                return (
                  <li key={option.key}>
                    <label
                      className={cn(
                        'border-border flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors',
                        'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2',
                        !answered && 'hover:bg-muted/60',
                        isChosen && outcome === null && 'border-primary bg-primary/5',
                        isRightAnswer && 'border-mastery-strong bg-mastery-strong/10',
                        isWrongChoice && 'border-destructive bg-destructive/10',
                        answered && 'cursor-default',
                      )}
                    >
                      <input
                        type="radio"
                        name={`checkpoint-${checkpoint.id}`}
                        value={option.key}
                        checked={isChosen}
                        onChange={() => setSelected(option.key)}
                        className="accent-primary mt-0.5 size-4 shrink-0"
                      />
                      <span className="text-foreground font-medium">{option.key}</span>
                      <span className="text-foreground min-w-0 flex-1">{option.text}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        ) : null}

        {errorMessage ? (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive mb-3 rounded-md border px-3 py-2 text-sm"
          >
            {errorMessage}
          </p>
        ) : null}

        {/* Sonuç ve "atlandı" duyurusu tek KALICI bölgeden gider; görsel
            kutular yalnızca gözle okunur. */}
        <LiveRegion
          message={
            outcome
              ? outcome.isCorrect
                ? strings.checkpointCorrect
                : strings.checkpointWrong
              : skipped
                ? strings.checkpointSkipped
                : ''
          }
        />

        {outcome ? (
          <div className="mb-4 space-y-2">
            <p
              className={cn(
                'flex items-center gap-2 text-sm font-medium',
                outcome.isCorrect ? 'text-mastery-strong' : 'text-destructive',
              )}
            >
              {outcome.isCorrect ? (
                <CheckCircle2 aria-hidden="true" className="size-4" />
              ) : (
                <XCircle aria-hidden="true" className="size-4" />
              )}
              {outcome.isCorrect ? strings.checkpointCorrect : strings.checkpointWrong}
            </p>

            {!outcome.isCorrect ? (
              <p className="text-muted-foreground text-sm">
                {fill(strings.checkpointCorrectOption, {
                  option: correctOptionText
                    ? `${outcome.correctOption} — ${correctOptionText}`
                    : outcome.correctOption,
                })}
              </p>
            ) : null}

            {outcome.explanation ? (
              <div className="border-border bg-muted/40 rounded-md border p-3">
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
                  {strings.checkpointExplanation}
                </p>
                <Markdown content={outcome.explanation} />
              </div>
            ) : null}
          </div>
        ) : null}

        {skipped ? (
          <p className="text-muted-foreground mb-4 text-sm">{strings.checkpointSkipped}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {answered ? (
            <Button type="button" onClick={onResume} autoFocus>
              {strings.checkpointContinue}
            </Button>
          ) : (
            <>
              <Button type="button" onClick={handleAnswer} disabled={!selected || pending}>
                {strings.checkpointAnswer}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSkipped(true)}
                disabled={pending}
              >
                {strings.checkpointSkip}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
