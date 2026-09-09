import Link from 'next/link'
import { CalendarClock, CircleDashed, FileText, Lock, Target } from 'lucide-react'
import { buttonVariants } from '@zihin/ui/button'
import { cn } from '@zihin/ui/lib/utils'
import { countdownTarget, isMockStartable, type MockWindowState } from '@/lib/mock/window'
import type { MockAttemptState } from '@/lib/mock/status'
import { fill, section } from '@/lib/i18n'
import { MockCountdown } from './mock-countdown'
import { StartMockButton } from './start-mock-button'
import type { MockStrings } from './strings'

/**
 * Listedeki tek bir deneme kartı (ekran §9.12).
 *
 * Sunucu bileşenidir; içinde yalnızca sayaç ve başlat düğmesi istemcidir.
 *
 * DÜĞMENİN GÖRÜNMESİ YETKİ DEĞİLDİR: canlı pencere `startMock` ve `startTest`
 * içinde, sunucuda denetlenir. Buradaki koşul yalnızca kullanıcıya doğru şeyi
 * göstermek içindir.
 */

export type MockCardSection = { name: string; count: number }

export type MockCardProps = {
  testId: string
  title: string
  questionCount: number
  /** Denemenin hedeflediği soru sayısı; havuz eksikse uyarı buradan çıkar. */
  targetQuestions: number | null
  durationSeconds: number | null
  sections: MockCardSection[]
  windowState: MockWindowState
  liveWindowStart: string | null
  liveWindowEnd: string | null
  state: MockAttemptState
  /** Tamamlanmış denemenin neti; özet okunamıyorsa null. */
  net: number | null
}

export function MockCard(props: MockCardProps) {
  const s = section<MockStrings>('mock')
  const startable = isMockStartable(props.windowState)
  const target = countdownTarget(
    { live_window_start: props.liveWindowStart, live_window_end: props.liveWindowEnd },
    props.windowState,
  )

  return (
    <li className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-foreground text-base font-semibold">{props.title}</h2>
        <StatusBadge state={props.state} net={props.net} strings={s} />
      </div>

      <dl className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{s.sectionsLabel}</dt>
          <FileText aria-hidden="true" className="size-4" />
          <dd className="tabular-nums">{fill(s.questionCount, { count: props.questionCount })}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{s.durationMinutes}</dt>
          <CalendarClock aria-hidden="true" className="size-4" />
          <dd className="tabular-nums">
            {props.durationSeconds && props.durationSeconds > 0
              ? fill(s.durationMinutes, { minutes: Math.round(props.durationSeconds / 60) })
              : s.noDuration}
          </dd>
        </div>
      </dl>

      {props.sections.length > 0 ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium">{s.sectionsLabel}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {props.sections.map((entry) => (
              <li
                key={entry.name}
                className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs"
              >
                {fill(s.sectionCount, { name: entry.name, count: entry.count })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Tohum içerikte 90 sorunun 20'si var; öğrenciye bunun bir arıza değil,
          havuzun durumu olduğu söylenir. */}
      {props.targetQuestions !== null && props.questionCount < props.targetQuestions ? (
        <p className="text-muted-foreground text-xs">
          {fill(s.partialNotice, { count: props.questionCount })}
        </p>
      ) : null}

      {target ? (
        <MockCountdown
          target={target}
          label={props.windowState === 'before' ? s.windowBefore : s.windowOpen}
        />
      ) : null}

      <p className="text-muted-foreground text-xs">{windowHint(props.windowState, s)}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {props.state.kind === 'in_progress' ? (
          <Link
            href={`/deneme/${props.state.sessionId}`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            {s.resume}
          </Link>
        ) : null}

        {props.state.kind === 'finished' ? (
          <Link
            href={`/deneme/sonuc/${props.state.sessionId}`}
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
          >
            {s.viewResult}
          </Link>
        ) : null}

        {props.state.kind !== 'in_progress' && startable ? (
          <StartMockButton
            testId={props.testId}
            variant={props.state.kind === 'finished' ? 'ghost' : 'default'}
          >
            {props.state.kind === 'finished' ? s.retry : s.start}
          </StartMockButton>
        ) : null}

        {!startable && props.state.kind !== 'finished' ? (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Lock aria-hidden="true" className="size-3.5" />
            {props.windowState === 'before' ? s.windowBefore : s.windowClosedTitle}
          </span>
        ) : null}
      </div>
    </li>
  )
}

function windowHint(state: MockWindowState, s: MockStrings): string {
  if (state === 'before') return s.windowBeforeHint
  if (state === 'open') return s.windowOpenHint
  if (state === 'closed') return s.windowClosedHint
  return s.subtitle
}

/** Durum rozeti. Renk tek başına anlam taşımaz: her rozet metin ve simge taşır. */
function StatusBadge({
  state,
  net,
  strings,
}: {
  state: MockAttemptState
  net: number | null
  strings: MockStrings
}) {
  if (state.kind === 'finished') {
    return (
      <span className="text-mastery-strong flex items-center gap-1.5 text-sm font-medium">
        <Target aria-hidden="true" className="size-4" />
        {strings.statusFinished}
        {net !== null ? (
          <span className="text-foreground tabular-nums">
            {`${net.toFixed(2)} ${strings.netLabel}`}
          </span>
        ) : null}
      </span>
    )
  }

  if (state.kind === 'in_progress') {
    return (
      <span className="text-mastery-medium flex items-center gap-1.5 text-sm font-medium">
        <CircleDashed aria-hidden="true" className="size-4" />
        {strings.statusInProgress}
      </span>
    )
  }

  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
      <CircleDashed aria-hidden="true" className="size-4" />
      {strings.statusNotStarted}
    </span>
  )
}
