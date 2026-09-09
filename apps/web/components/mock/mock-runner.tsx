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
} from '@/components/test/runner-state'
import type { RunnerQuestion } from '@/components/test/test-runner'
import type { TestStrings } from '@/components/test/strings'
import { sectionProgress, totalProgress, type MockSection } from '@/lib/mock/sections'
import { fill, section } from '@/lib/i18n/mock'
import type { MockStrings } from './strings'

/**
 * Deneme çözme ekranı (spec §9.12).
 *
 * ── NEDEN AYRI BİR BİLEŞEN ─────────────────────────────────────────────────
 * `TestRunner`'a isteğe bağlı bir `sections` desteği eklemek denendiğinde
 * bileşenin ÜÇ ayrı bloğu (ızgara, gezinme, sayaç başlığı) koşullu iki hâle
 * bölünüyordu; konu testinin çalışan akışını bunun için riske atmak doğru
 * değil. Bunun yerine SAF YARDIMCILAR paylaşılıyor:
 * `components/test/runner-state.ts` (sayaç, ızgara durumu, klavye eşlemesi),
 * `lib/test-engine/session.ts` (`nextUnanswered`) ve `lib/mock/sections.ts`.
 * Kopyalanan tek şey JSX düzeni; hesap hiçbir yerde ikinci kez yazılmadı.
 *
 * ── DENEMENİN KONU TESTİNDEN FARKI ─────────────────────────────────────────
 *  • Üstte ders sekmeleri; her sekme kendi bölümünün cevaplanan/toplam sayısını
 *    taşır.
 *  • Soru ızgarası SEÇİLİ BÖLÜMÜNDÜR; 90 soruluk bir denemede tek bir ızgara
 *    okunmaz hâle gelir.
 *  • Sayaç TEK ve GENELDİR: bölüm başına süre yoktur, sıfırda deneme
 *    kendiliğinden gönderilir.
 *
 * Oturum makinesi ORTAKTIR: `submitAnswer` ve `finishTest` doğrudan test
 * motorundan çağrılır, ikinci bir yaşam döngüsü kurulmaz. `attempts.source`
 * bu sayede `tests.type` üzerinden `'mock_exam'` olur.
 *
 * Soru içeriği SUNUCUDA render edilir (Markdown + KaTeX istemci paketine
 * girmez) ve doğru cevap bu ekranda hiç bulunmaz.
 */

const s = section<TestStrings>('test')
const m = section<MockStrings>('mock')

type SaveState = 'saving' | 'saved' | 'error'

export type MockRunnerProps = {
  sessionId: string
  /** Oturumun tüm soruları; sıra `sections` üzerinden kurulur. */
  questions: RunnerQuestion[]
  /** Ders bölümleri, sınavdaki sırayla. */
  sections: MockSection[]
  initialAnswers: Record<string, string | null>
  durationSeconds: number | null
  startedAt: string
  resumed: boolean
}

export function MockRunner({
  sessionId,
  questions,
  sections,
  initialAnswers,
  durationSeconds,
  startedAt,
  resumed,
}: MockRunnerProps) {
  const router = useRouter()

  const questionById = React.useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  )

  // Doğrusal sıra BÖLÜM SIRASIYLA kurulur: "sonraki soru" aynı dersin içinde
  // ilerler, ders bitince diğerine geçer. Karıştırılmış oturum sırası bölüm
  // içinde korunur.
  const order = React.useMemo(
    () =>
      sections.flatMap((group) =>
        group.questionIds.filter((questionId) => questionById.has(questionId)),
      ),
    [questionById, sections],
  )

  const sectionOfQuestion = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const group of sections) {
      for (const questionId of group.questionIds) map.set(questionId, group.key)
    }
    return map
  }, [sections])

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

  const currentId = order[index]
  const current = currentId ? questionById.get(currentId) : undefined

  // Aktif sekme AYRI BİR DURUM DEĞİL, mevcut sorudan türetilir: iki kaynak
  // olsaydı ızgara ile soru birbirinden ayrı düşebilirdi.
  const activeSectionKey = currentId
    ? (sectionOfQuestion.get(currentId) ?? sections[0]?.key ?? null)
    : (sections[0]?.key ?? null)
  const activeSection = sections.find((group) => group.key === activeSectionKey) ?? null

  const progress = React.useMemo(() => sectionProgress(sections, answers), [answers, sections])
  const overall = totalProgress(progress)

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
    if (finishedRef.current) return
    finishedRef.current = true
    setFinishing(true)
    setConfirmOpen(false)

    try {
      const result = await finishTest({ sessionId })
      if (result.ok) {
        router.replace(`/deneme/sonuc/${sessionId}`)
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
   * Genel sayaç — sıfırda deneme kendiliğinden gönderilir
   * --------------------------------------------------------------------- */

  React.useEffect(() => {
    if (durationSeconds === null) return

    const tick = () => {
      const next = remainingSeconds(startedAt, durationSeconds, Date.now())
      if (next === null) return

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
    (next: number) => setIndex(wrapIndex(next, order.length)),
    [order.length],
  )

  const goNextBlank = React.useCallback(() => {
    const target = nextUnanswered(order, answeredIds(order, answers), index)
    if (target === null) {
      toast.info(s.noBlankLeft)
      return
    }
    setIndex(target)
  }, [answers, index, order])

  /**
   * Sekmeye tıklamak o dersin İLK BOŞ sorusuna götürür; hepsi doluysa ilk
   * sorusuna. Ders değiştiren öğrenci genellikle bıraktığı yerden devam etmek
   * ister.
   */
  const goToSection = React.useCallback(
    (key: string) => {
      const group = sections.find((entry) => entry.key === key)
      if (!group) return
      const candidates = group.questionIds.filter((questionId) => questionById.has(questionId))
      const firstBlank = candidates.find((questionId) => {
        const answer = answers.get(questionId)
        return answer === undefined || answer === null
      })
      const targetId = firstBlank ?? candidates[0]
      if (!targetId) return
      const targetIndex = order.indexOf(targetId)
      if (targetIndex >= 0) setIndex(targetIndex)
    },
    [answers, order, questionById, sections],
  )

  const toggleFlag = React.useCallback((questionId: string) => {
    setFlagged((previous) => {
      const next = new Set(previous)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }, [])

  /* --------------------------------------------------------------------- *
   * Klavye
   * --------------------------------------------------------------------- */

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (confirmOpen || finishing) return

      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return
      }

      const questionId = order[index]
      const question = questionId ? questionById.get(questionId) : undefined
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
  }, [confirmOpen, finishing, goTo, index, order, questionById, save])

  /* --------------------------------------------------------------------- *
   * Render
   * --------------------------------------------------------------------- */

  if (!current || !currentId) return null

  const blanks = blankCount(order, answers)
  const selected = answers.get(currentId) ?? null
  const saveState = saveStates.get(currentId)

  return (
    <div className="space-y-4">
      {resumed ? (
        <p className="border-border bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-sm">
          {s.resumedNotice}
        </p>
      ) : null}

      {/* Ders sekmeleri. Radix Tabs yerine düz düğmeler: sekme, içerik
          değiştirmiyor — soruya ve ızgaraya gidiyor. `aria-pressed` bu davranışı
          `aria-selected`ten daha doğru anlatır. */}
      <div
        className="border-border flex flex-wrap gap-2 overflow-x-auto rounded-lg border p-2"
        role="group"
        aria-label={m.runner.sectionsLabel}
      >
        {progress.map((entry) => {
          const isActive = entry.key === activeSectionKey
          return (
            <Button
              key={entry.key}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'ghost'}
              aria-pressed={isActive}
              aria-label={fill(m.runner.sectionTab, {
                name: entry.name,
                answered: entry.answered,
                total: entry.total,
              })}
              onClick={() => goToSection(entry.key)}
            >
              <span>{entry.name}</span>
              <span className="ml-1.5 text-xs tabular-nums opacity-80">
                {fill(m.runner.sectionProgress, {
                  answered: entry.answered,
                  total: entry.total,
                })}
              </span>
            </Button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm font-medium tabular-nums">
              {fill(s.questionCounter, { current: index + 1, total: order.length })}
            </p>
            <div className="flex items-center gap-2">
              <SaveIndicator state={saveState} onRetry={() => void save(currentId, selected)} />
              <Button
                type="button"
                size="sm"
                variant={flagged.has(currentId) ? 'default' : 'outline'}
                aria-pressed={flagged.has(currentId)}
                onClick={() => toggleFlag(currentId)}
              >
                <Flag aria-hidden="true" className="size-4" />
                {flagged.has(currentId) ? s.runner.unflag : s.runner.flag}
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
                      onClick={() => void save(currentId, option.key)}
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
                onClick={() => void save(currentId, null)}
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

          <p aria-live="polite" role="status" className="sr-only">
            {announcement}
          </p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {remaining !== null ? (
            <Countdown seconds={remaining} label={m.runner.globalTimer} />
          ) : null}

          <div className="border-border rounded-lg border p-3">
            <p className="text-foreground text-sm font-medium">
              {activeSection ? fill(m.runner.sectionGrid, { name: activeSection.name }) : s.grid}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
              {fill(m.runner.overallProgress, {
                answered: overall.answered,
                total: overall.total,
              })}
            </p>

            {activeSection && activeSection.questionIds.length > 0 ? (
              <ul className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
                {activeSection.questionIds
                  .filter((questionId) => questionById.has(questionId))
                  .map((questionId) => {
                    // Numara DENEMENİN GENELİNDEKİ sırasıdır; bölüm içinde 1'den
                    // başlamak, üstteki "13 / 90" sayacıyla çelişirdi.
                    const questionIndex = order.indexOf(questionId)
                    const status = cellStatus(questionId, answers, flagged)
                    const isCurrent = questionIndex === index
                    return (
                      <li key={questionId}>
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
                            // Şekil de kodlar: işaretli hücre yuvarlaktır. Renk
                            // tek başına anlam taşımaz (CONVENTIONS §8).
                            status === 'flagged' ? 'rounded-full' : 'rounded-md',
                            STATUS_CLASSES[status],
                            isCurrent && 'ring-ring ring-2 ring-offset-2',
                          )}
                        >
                          {questionIndex + 1}
                          {status === 'answered' ? (
                            <Check
                              aria-hidden="true"
                              className="absolute -right-0.5 -top-0.5 size-3"
                            />
                          ) : null}
                          {status === 'flagged' ? (
                            <Flag
                              aria-hidden="true"
                              className="absolute -right-0.5 -top-0.5 size-3"
                            />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
              </ul>
            ) : (
              // Havuzu tamamlanmamış bir denemede bir ders bölümü boş kalabilir;
              // bozuk değil, henüz sorusu yok.
              <p className="text-muted-foreground mt-3 text-xs">{m.runner.sectionEmpty}</p>
            )}

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
      </div>

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

/** Denemenin tek, genel sayacı. 1 dakikanın altında uyarı rengine döner. */
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
