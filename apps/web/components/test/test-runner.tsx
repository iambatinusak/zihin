'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Check, Flag, Loader2, RotateCw, Timer } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@zihin/ui/alert-dialog'
import { cn } from '@zihin/ui/lib/utils'
import { finishTest, submitAnswer } from '@/app/(student)/test/actions'
import { nextUnanswered } from '@/lib/test-engine/session'
import { section } from '@/lib/i18n/test'
import { fill } from '@/lib/i18n/test'
import type { TestStrings } from './strings'
import {
  answeredIds,
  blankCount,
  cellStatus,
  crossedWarning,
  formatClock,
  optionIndexFromKey,
  remainingSeconds,
  wrapIndex,
  type CellStatus,
} from './runner-state'

/**
 * Test çözme ekranı (spec §9.8).
 *
 * SORU İÇERİĞİ SUNUCUDA RENDER EDİLİR: `stem` ve şık metinleri hazır React
 * düğümü olarak gelir. Sebep, Markdown + KaTeX yığınının (react-markdown,
 * rehype-katex, rehype-sanitize) istemci paketine hiç girmemesi; ayrıca
 * temizleme şeması yalnızca sunucuda kalır.
 *
 * SAYAÇ İSTEMCİ SAYACI DEĞİLDİR: kalan süre her tikte `started_at + süre`
 * farkından yeniden hesaplanır. Sekme uyutulsa, sayfa yenilense ya da tarayıcı
 * zamanlayıcıyı kıssa da kalan süre doğru kalır.
 *
 * DOĞRU CEVAP BURADA YOKTUR; `submitAnswer` yalnızca `{ saved: true }` döner.
 */

export type RunnerOption = { key: string; label: React.ReactNode }

export type RunnerQuestion = {
  id: string
  stem: React.ReactNode
  imageUrl: string | null
  options: RunnerOption[]
}

export type TestRunnerProps = {
  sessionId: string
  questions: RunnerQuestion[]
  /** Sürdürülen oturumda daha önce kaydedilmiş şıklar. */
  initialAnswers: Record<string, string | null>
  durationSeconds: number | null
  startedAt: string
  /** Yarım kalan bir oturuma dönüldüyse kullanıcıya söylenir. */
  resumed: boolean
}

type SaveState = 'saving' | 'saved' | 'error'

/**
 * Sözlük modül düzeyinde okunur: tek dilli ve değişmez olduğu için her
 * render'da yeni bir nesne üretmesi `useCallback` bağımlılıklarını boşuna
 * tazeler ve klavye dinleyicisini her render'da yeniden bağlardı.
 */
const s = section<TestStrings>('test')

export function TestRunner({
  sessionId,
  questions,
  initialAnswers,
  durationSeconds,
  startedAt,
  resumed,
}: TestRunnerProps) {
  const router = useRouter()

  const order = React.useMemo(() => questions.map((question) => question.id), [questions])

  const [index, setIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<Map<string, string | null>>(
    () => new Map(Object.entries(initialAnswers)),
  )
  const [flagged, setFlagged] = React.useState<Set<string>>(() => new Set())
  const [saveStates, setSaveStates] = React.useState<Map<string, SaveState>>(() => new Map())
  const [announcement, setAnnouncement] = React.useState('')
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [finishing, setFinishing] = React.useState(false)
  const [remaining, setRemaining] = React.useState<number | null>(() =>
    remainingSeconds(startedAt, durationSeconds, Date.now()),
  )

  const current = questions[index]

  /** Bir önceki tikte kalan süre — uyarı eşiği karşılaştırması için. */
  const lastRemainingRef = React.useRef<number | null>(
    remainingSeconds(startedAt, durationSeconds, Date.now()),
  )

  /* --------------------------------------------------------------------- *
   * Süre ölçümü — soru başına harcanan zaman
   * --------------------------------------------------------------------- */

  const spentRef = React.useRef<Map<string, number>>(new Map())
  const enteredAtRef = React.useRef<number>(Date.now())

  React.useEffect(() => {
    enteredAtRef.current = Date.now()
  }, [index])

  /** Bu soruda o ana kadar geçen toplam süre (ms). */
  const takeElapsed = React.useCallback((questionId: string) => {
    const now = Date.now()
    const previous = spentRef.current.get(questionId) ?? 0
    const total = previous + Math.max(0, now - enteredAtRef.current)
    spentRef.current.set(questionId, total)
    enteredAtRef.current = now
    // Şema üst sınırı 6 saat; sekmesi açık unutulmuş tarayıcıdan gelen değer
    // reddedilip cevabı düşürmesin diye burada da kırpılır.
    return Math.min(total, 6 * 60 * 60 * 1000)
  }, [])

  /* --------------------------------------------------------------------- *
   * Cevap kaydetme (iyimser)
   * --------------------------------------------------------------------- */

  const save = React.useCallback(
    async (questionId: string, option: string | null) => {
      // Önce arayüz: seçim anında görünür, ağ beklenmez (spec §10).
      setAnswers((previous) => new Map(previous).set(questionId, option))
      setSaveStates((previous) => new Map(previous).set(questionId, 'saving'))

      const timeSpentMs = takeElapsed(questionId)

      try {
        const result = await submitAnswer({
          sessionId,
          questionId,
          selectedOption: option,
          timeSpentMs,
        })
        if (result.ok) {
          setSaveStates((previous) => new Map(previous).set(questionId, 'saved'))
          setAnnouncement(
            option === null ? s.clearSelection : fill(s.runner.optionSelected, { option }),
          )
          return
        }
        setSaveStates((previous) => new Map(previous).set(questionId, 'error'))
        toast.error(result.error.message)
      } catch {
        // Ağ kesintisi: cevap ekranda DURUR, kullanıcı tekrar deneyebilir.
        setSaveStates((previous) => new Map(previous).set(questionId, 'error'))
        toast.error(s.saveFailed)
      }
    },
    [sessionId, takeElapsed],
  )

  /* --------------------------------------------------------------------- *
   * Bitirme
   * --------------------------------------------------------------------- */

  const finishedRef = React.useRef(false)

  const finish = React.useCallback(async () => {
    // İki kez bitirme (süre dolarken düğmeye basmak) tek çağrıya iner.
    if (finishedRef.current) return
    finishedRef.current = true
    setFinishing(true)
    setConfirmOpen(false)

    try {
      const result = await finishTest({ sessionId })
      if (result.ok) {
        router.replace(`/sonuc/${sessionId}`)
        return
      }
      finishedRef.current = false
      setFinishing(false)
      toast.error(result.error.message)
    } catch {
      finishedRef.current = false
      setFinishing(false)
      toast.error(s.saveFailed)
    }
  }, [router, sessionId])

  /* --------------------------------------------------------------------- *
   * Sayaç
   * --------------------------------------------------------------------- */

  React.useEffect(() => {
    if (durationSeconds === null) return

    const tick = () => {
      const next = remainingSeconds(startedAt, durationSeconds, Date.now())
      if (next === null) return

      // Uyarı, `setRemaining`in güncelleyicisi İÇİNDE verilmez: React
      // güncelleyiciyi (StrictMode'da ve yeniden denemelerde) birden çok kez
      // çağırabilir ve uyarı iki kez görünürdü. Karşılaştırma ref üzerinden.
      const previous = lastRemainingRef.current
      lastRemainingRef.current = next
      if (previous !== null) {
        const threshold = crossedWarning(previous, next)
        if (threshold !== null) {
          toast.warning(
            threshold >= 120
              ? fill(s.runner.warningMinutes, { minutes: Math.round(threshold / 60) })
              : s.runner.warningLastMinute,
          )
        }
      }

      setRemaining(next)
    }

    const timer = window.setInterval(tick, 1000)
    // Sekme arka plandayken tarayıcı zamanlayıcıyı kısar; geri dönüldüğünde
    // kalan süre hemen düzeltilsin.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [durationSeconds, startedAt])

  React.useEffect(() => {
    if (remaining !== 0) return
    toast.warning(s.timeUp)
    void finish()
  }, [finish, remaining])

  /* --------------------------------------------------------------------- *
   * Gezinme
   * --------------------------------------------------------------------- */

  const goTo = React.useCallback(
    (next: number) => setIndex(wrapIndex(next, questions.length)),
    [questions.length],
  )

  const goNextBlank = React.useCallback(() => {
    const target = nextUnanswered(order, answeredIds(order, answers), index)
    if (target === null) {
      toast.info(s.noBlankLeft)
      return
    }
    setIndex(target)
  }, [answers, index, order])

  const toggleFlag = React.useCallback((questionId: string) => {
    setFlagged((previous) => {
      const next = new Set(previous)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }, [])

  /* --------------------------------------------------------------------- *
   * Klavye (spec §9.8: test ekranı tamamen klavyeyle kullanılabilir)
   * --------------------------------------------------------------------- */

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (confirmOpen || finishing) return

      const target = event.target as HTMLElement | null
      // Metin alanında yazarken "1" tuşu şık seçmemeli.
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return
      }

      const question = questions[index]
      if (!question) return

      const optionIndex = optionIndexFromKey(event.key)
      if (optionIndex !== null) {
        const option = question.options[optionIndex]
        if (!option) return
        event.preventDefault()
        void save(question.id, option.key)
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        goTo(index + 1)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goTo(index - 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmOpen, finishing, goTo, index, questions, save])

  /* --------------------------------------------------------------------- *
   * Render
   * --------------------------------------------------------------------- */

  if (!current) return null

  const blanks = blankCount(order, answers)
  const answered = order.length - blanks
  const selected = answers.get(current.id) ?? null
  const saveState = saveStates.get(current.id)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-4">
        {resumed ? (
          <p className="border-border bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-sm">
            {s.resumedNotice}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm font-medium tabular-nums">
            {fill(s.questionCounter, { current: index + 1, total: order.length })}
          </p>
          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} onRetry={() => void save(current.id, selected)} />
            <Button
              type="button"
              size="sm"
              variant={flagged.has(current.id) ? 'default' : 'outline'}
              aria-pressed={flagged.has(current.id)}
              onClick={() => toggleFlag(current.id)}
            >
              <Flag aria-hidden="true" className="size-4" />
              {flagged.has(current.id) ? s.runner.unflag : s.runner.flag}
            </Button>
          </div>
        </div>

        <article className="border-border rounded-lg border p-4">
          <h2 className="sr-only">{fill(s.questionLabel, { index: index + 1 })}</h2>
          {current.stem}
          {current.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.imageUrl}
              alt={s.runner.questionImage}
              className="mt-3 h-auto max-w-full rounded-md"
            />
          ) : null}

          <ul className="mt-4 space-y-2">
            {current.options.map((option, optionIndex) => {
              const isSelected = selected === option.key
              return (
                <li key={option.key}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => void save(current.id, option.key)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:bg-muted/60',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      {option.key}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="sr-only">{`${option.key}. `}</span>
                      {option.label}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {optionIndex + 1}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {selected !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => void save(current.id, null)}
            >
              {s.clearSelection}
            </Button>
          ) : null}
        </article>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => goTo(index - 1)}>
            {s.previous}
          </Button>
          <Button type="button" variant="outline" onClick={() => goTo(index + 1)}>
            {s.next}
          </Button>
          <Button type="button" variant="ghost" onClick={goNextBlank}>
            {s.nextBlank}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">{s.runner.keyboardHint}</p>
        <p className="text-muted-foreground text-xs">{s.noFeedbackHint}</p>

        {/* Cevap kaydı ekran okuyucuya duyurulur; görsel gösterge sağ üstte. */}
        <p aria-live="polite" role="status" className="sr-only">
          {announcement}
        </p>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {remaining !== null ? <Countdown seconds={remaining} label={s.timeRemaining} /> : null}

        <div className="border-border rounded-lg border p-3">
          <p className="text-foreground text-sm font-medium">{s.grid}</p>
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
            {fill(s.runner.answeredOf, { answered, total: order.length })}
          </p>

          <ul className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
            {questions.map((question, questionIndex) => {
              const status = cellStatus(question.id, answers, flagged)
              const isCurrent = questionIndex === index
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(questionIndex)}
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={fill(s.runner.gridStatus, {
                      index: questionIndex + 1,
                      status: statusLabel(status),
                    })}
                    className={cn(
                      'relative flex size-9 items-center justify-center border text-xs font-semibold tabular-nums transition-colors',
                      // Şekil de kodlar: işaretli hücre yuvarlaktır, diğerleri
                      // köşeli. Renk tek başına anlam taşımaz (CONVENTIONS §8).
                      status === 'flagged' ? 'rounded-full' : 'rounded-md',
                      STATUS_CLASSES[status],
                      isCurrent && 'ring-ring ring-2 ring-offset-2',
                    )}
                  >
                    {questionIndex + 1}
                    {status === 'answered' ? (
                      <Check aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-3" />
                    ) : null}
                    {status === 'flagged' ? (
                      <Flag aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-3" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>

          <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
            <LegendItem
              className={STATUS_CLASSES.blank}
              shape="rounded-md"
              label={s.gridLegendBlank}
            />
            <LegendItem
              className={STATUS_CLASSES.answered}
              shape="rounded-md"
              icon={<Check aria-hidden="true" className="size-3" />}
              label={s.gridLegendAnswered}
            />
            <LegendItem
              className={STATUS_CLASSES.flagged}
              shape="rounded-full"
              icon={<Flag aria-hidden="true" className="size-3" />}
              label={s.runner.gridLegendFlagged}
            />
          </ul>
        </div>

        <p className="text-muted-foreground text-xs">{s.autosaveHint}</p>

        <Button
          type="button"
          className="w-full"
          disabled={finishing}
          onClick={() => setConfirmOpen(true)}
        >
          {finishing ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
          {finishing ? s.runner.finishing : s.finish}
        </Button>
      </aside>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.finishConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {blanks > 0 ? fill(s.finishConfirmBlank, { count: blanks }) : s.finishConfirmComplete}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{s.finishCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void finish()}>
              {s.finishConfirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const STATUS_CLASSES: Record<CellStatus, string> = {
  blank: 'border-border bg-background text-muted-foreground',
  answered: 'border-primary bg-primary/15 text-foreground',
  flagged: 'border-mastery-medium bg-mastery-medium/20 text-foreground',
}

function statusLabel(status: CellStatus): string {
  if (status === 'answered') return s.gridLegendAnswered
  if (status === 'flagged') return s.runner.gridLegendFlagged
  return s.gridLegendBlank
}

function LegendItem({
  className,
  shape,
  icon,
  label,
}: {
  className: string
  shape: string
  icon?: React.ReactNode
  label: string
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn('flex size-4 items-center justify-center border', shape, className)}
      >
        {icon}
      </span>
      {label}
    </li>
  )
}

/** Kalan süre. 1 dakikanın altında uyarı rengine döner. */
function Countdown({ seconds, label }: { seconds: number; label: string }) {
  const critical = seconds <= 60
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        critical ? 'border-destructive text-destructive' : 'border-border text-foreground',
      )}
    >
      {critical ? (
        <AlertTriangle aria-hidden="true" className="size-4" />
      ) : (
        <Timer aria-hidden="true" className="size-4" />
      )}
      <span className="text-muted-foreground text-xs">{label}</span>
      {/* Sayaç her saniye değişiyor; ekran okuyucuya sürekli okutulmaz. */}
      <span aria-live="off" className="ml-auto text-base font-semibold tabular-nums">
        {formatClock(seconds)}
      </span>
    </div>
  )
}

function SaveIndicator({ state, onRetry }: { state: SaveState | undefined; onRetry: () => void }) {
  if (state === undefined) return null

  if (state === 'error') {
    return (
      <span className="text-destructive flex items-center gap-1.5 text-xs">
        <AlertTriangle aria-hidden="true" className="size-3.5" />
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCw aria-hidden="true" className="size-3.5" />
          {s.runner.retrySave}
        </Button>
      </span>
    )
  }

  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      {state === 'saving' ? (
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
      ) : (
        <Check aria-hidden="true" className="text-primary size-3.5" />
      )}
      {state === 'saving' ? s.saving : s.saved}
    </span>
  )
}
