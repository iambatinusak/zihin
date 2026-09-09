'use client'

import * as React from 'react'
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Slider } from '@zihin/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zihin/ui/select'
import { cn } from '@zihin/ui/lib/utils'
import { completeVideo, saveProgress } from '@/app/(student)/video/actions'
import { CheckpointOverlay, type OverlayCheckpoint } from './checkpoint-overlay'
import { ShortcutsHelp } from './shortcuts-help'
import { PLAYBACK_RATES, formatClock, formatRate, formatSpokenTime } from './format'
import { fill } from '@/lib/i18n/core'
import {
  PROGRESS_SAVE_INTERVAL_MS,
  SEEK_STEP_SECONDS,
  VOLUME_STEP,
  clampTime,
  clampVolume,
  dueCheckpoint,
  hasReachedCompletion,
  isHlsSource,
  percentSeekTarget,
  seekTarget,
  timeFromRatio,
  toPercent,
  watchedDelta,
} from './playback'
import type { VideoStrings } from './strings'

/**
 * HTML5 oynatıcı + HLS + ilerleme kaydı + checkpoint duraklamaları.
 *
 * Üç davranış kuralı:
 *  1. İlerleme 10 saniyede bir, ayrıca duraklamada, sarma bitiminde, sekme
 *     gizlenince ve bileşen sökülürken kaydedilir (spec §M3 AC: yeniden
 *     yüklemede ±10 saniye doğrulukla devam).
 *  2. İzleme süresi konum FARKINDAN değil, gerçekten oynayan süreden birikir;
 *     ileri sarma sayaca eklenmez (bkz. `playback.ts` → `watchedDelta`).
 *  3. Kısayollar yalnızca oynatıcı odaktayken çalışır; sayfanın klavyesi
 *     ele geçirilmez.
 */

export type PlayerCheckpoint = OverlayCheckpoint

export type VideoPlayerHandle = {
  /** Not listesinden bir ana atlamak için. */
  seekTo: (seconds: number) => void
  /** "Şu an için not ekle" için anlık konum. */
  currentTime: () => number
}

type VideoPlayerProps = {
  videoId: string
  src: string
  durationSeconds: number
  posterUrl?: string | null
  /** `video_progress.last_position_seconds` — burada devam edilir. */
  startAtSeconds: number
  /** Kullanıcının bu videoda daha önce biriktirdiği izleme süresi. */
  initialWatchedSeconds: number
  alreadyCompleted: boolean
  checkpoints: PlayerCheckpoint[]
  strings: VideoStrings
  /** Not sekmesinin gösterdiği "şu anki konum" bununla tazelenir. */
  onTimeChange?: (seconds: number) => void
  handleRef?: React.Ref<VideoPlayerHandle>
}

/** Videonun sonuna 5 saniyeden az kalmışsa baştan başlanır, kaldığı yerden değil. */
const RESUME_TAIL_SECONDS = 5

export function VideoPlayer({
  videoId,
  src,
  durationSeconds,
  posterUrl,
  startAtSeconds,
  initialWatchedSeconds,
  alreadyCompleted,
  checkpoints,
  strings,
  onTimeChange,
  handleRef,
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const [playing, setPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(clampTime(startAtSeconds, durationSeconds))
  const [duration, setDuration] = React.useState(durationSeconds)
  const [bufferedEnd, setBufferedEnd] = React.useState(0)
  const [volume, setVolume] = React.useState(1)
  const [muted, setMuted] = React.useState(false)
  const [rate, setRate] = React.useState<number>(1)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [activeCheckpoint, setActiveCheckpoint] = React.useState<PlayerCheckpoint | null>(null)

  // Render'ı tetiklemeyen, olay işleyicilerinden okunan durum.
  const lastSampleRef = React.useRef<number>(clampTime(startAtSeconds, durationSeconds))
  const pendingWatchRef = React.useRef(0)
  const totalWatchedRef = React.useRef(Math.max(0, initialWatchedSeconds))
  const firedCheckpointsRef = React.useRef<Set<string>>(new Set())
  const completedRef = React.useRef(alreadyCompleted)
  const savingRef = React.useRef(false)
  const seekingRef = React.useRef(false)
  const resumeAfterCheckpointRef = React.useRef(false)
  /** Sunucuya en son yazılan konum; değişmediyse yeniden yazılmaz. */
  const lastSavedRef = React.useRef(clampTime(startAtSeconds, durationSeconds))

  const effectiveDuration = duration > 0 ? duration : durationSeconds
  const p = strings.player

  /** Konum + biriken izleme süresini sunucuya yazar. */
  const flushProgress = React.useCallback(async () => {
    const video = videoRef.current
    if (!video || savingRef.current) return

    const delta = Math.min(60, Math.max(0, pendingWatchRef.current))
    const position = clampTime(video.currentTime, effectiveDuration)
    // Hiç ilerleme yoksa sunucuyu boş yere meşgul etme.
    if (delta === 0 && Math.abs(position - lastSavedRef.current) < 1) return

    savingRef.current = true
    pendingWatchRef.current = 0
    lastSavedRef.current = position

    const result = await saveProgress({
      videoId,
      positionSeconds: position,
      watchedDeltaSeconds: delta,
    })
    savingRef.current = false

    if (!result.ok) {
      // Kaydedilemeyen artış kaybolmasın: bir sonraki turda yeniden denenir.
      pendingWatchRef.current += delta
      return
    }
    totalWatchedRef.current = result.data.watchTimeSeconds
    if (result.data.completed) completedRef.current = true

    const reached =
      result.data.eligibleForCompletion ||
      hasReachedCompletion(result.data.watchTimeSeconds, effectiveDuration)

    if (reached && !completedRef.current) {
      completedRef.current = true
      await completeVideo({ videoId })
    }
  }, [videoId, effectiveDuration])

  // ---- Kaynak bağlama: HLS ise hls.js, değilse doğrudan <video src>. -------
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    setFailed(false)

    if (!isHlsSource(src)) {
      video.src = src
      return
    }

    // Safari HLS'i yerel olarak oynatır; orada hls.js yüklemek gereksiz.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    let disposed = false
    let instance: { destroy: () => void } | null = null

    void import('hls.js').then((module) => {
      const Hls = module.default
      if (disposed || !Hls.isSupported()) {
        if (!disposed) setFailed(true)
        return
      }
      const hls = new Hls({ enableWorker: true })
      instance = hls
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setFailed(true)
      })
      hls.loadSource(src)
      hls.attachMedia(video)
    })

    return () => {
      disposed = true
      instance?.destroy()
    }
  }, [src])

  // ---- Devam etme: üst veri geldiğinde kaldığı konuma atlanır. -------------
  const resumeAppliedRef = React.useRef(false)
  const handleLoadedMetadata = React.useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration)

    if (resumeAppliedRef.current) return
    resumeAppliedRef.current = true

    const total =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationSeconds
    const target = clampTime(startAtSeconds, total)
    if (target > 0 && target < total - RESUME_TAIL_SECONDS) {
      video.currentTime = target
      lastSampleRef.current = target
      setCurrentTime(target)
    }
  }, [startAtSeconds, durationSeconds])

  // ---- İzleme sayacı + checkpoint tetikleme --------------------------------
  const handleTimeUpdate = React.useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const now = video.currentTime
    const previous = lastSampleRef.current

    // Sarma sırasında gelen örnekler sayaca girmez; `seeked` yeni temel atar.
    if (!seekingRef.current) {
      pendingWatchRef.current += watchedDelta(previous, now)
      totalWatchedRef.current += watchedDelta(previous, now)

      const due = dueCheckpoint(checkpoints, previous, now, firedCheckpointsRef.current)
      if (due) {
        firedCheckpointsRef.current.add(due.id)
        resumeAfterCheckpointRef.current = !video.paused
        video.pause()
        setActiveCheckpoint(due)
      }
    }

    lastSampleRef.current = now
    setCurrentTime(now)
    onTimeChange?.(now)

    const ranges = video.buffered
    setBufferedEnd(ranges.length > 0 ? ranges.end(ranges.length - 1) : 0)
  }, [checkpoints, onTimeChange])

  // ---- Kaydetme tetikleyicileri -------------------------------------------
  React.useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => void flushProgress(), PROGRESS_SAVE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [playing, flushProgress])

  React.useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') void flushProgress()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      // Sökülürken son konum yazılır: sayfadan ayrılan kullanıcı da kaldığı
      // yerden devam edebilsin.
      void flushProgress()
    }
  }, [flushProgress])

  // ---- Tam ekran durumu ----------------------------------------------------
  React.useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // ---- Denetimler ----------------------------------------------------------
  const togglePlay = React.useCallback(() => {
    const video = videoRef.current
    if (!video || activeCheckpoint) return
    if (video.paused) void video.play().catch(() => setFailed(true))
    else video.pause()
  }, [activeCheckpoint])

  const seekTo = React.useCallback(
    (seconds: number) => {
      const video = videoRef.current
      if (!video) return
      const target = clampTime(seconds, effectiveDuration)
      seekingRef.current = true
      video.currentTime = target
      lastSampleRef.current = target
      setCurrentTime(target)
      onTimeChange?.(target)
    },
    [effectiveDuration, onTimeChange],
  )

  const changeVolume = React.useCallback((next: number) => {
    const video = videoRef.current
    const value = clampVolume(next)
    setVolume(value)
    setMuted(value === 0)
    if (video) {
      video.volume = value
      video.muted = value === 0
    }
  }, [])

  const toggleMute = React.useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const next = !video.muted
    video.muted = next
    setMuted(next)
  }, [])

  const changeRate = React.useCallback((next: number) => {
    const video = videoRef.current
    setRate(next)
    if (video) video.playbackRate = next
  }, [])

  const toggleFullscreen = React.useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement === container) void document.exitFullscreen().catch(() => {})
    else void container.requestFullscreen().catch(() => {})
  }, [])

  React.useImperativeHandle(
    handleRef,
    () => ({
      seekTo,
      currentTime: () => videoRef.current?.currentTime ?? 0,
    }),
    [seekTo],
  )

  // ---- Klavye: yalnızca oynatıcı odaktayken --------------------------------
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Metin alanına ya da açık bir soruya yazılıyorsa kısayol çalışmaz.
      const target = event.target as HTMLElement | null
      if (
        activeCheckpoint ||
        (target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
      ) {
        return
      }

      const key = event.key
      const video = videoRef.current
      if (!video) return

      // Boşluk tuşu bir düğmenin ya da ses kaydırıcısının üstündeyken o öğeyi
      // çalıştırmalıdır; oynatıcı kısayolu onu ele geçirmez.
      const onInteractive =
        target !== null && target.closest('button, [role="slider"], [role="combobox"]') !== null
      if (onInteractive && (key === ' ' || key === 'Spacebar' || key === 'Enter')) return

      // Ses kaydırıcısı ve hız seçici ok tuşlarını kendileri işler; kapsayıcı
      // aynı tuşu ikinci kez uygularsa değer iki adım birden değişirdi.
      const ownsArrows =
        target !== null && target.closest('[data-slot="slider"], [role="combobox"]') !== null
      if (ownsArrows && key.startsWith('Arrow')) return

      if (key === ' ' || key === 'Spacebar' || key === 'k' || key === 'K') {
        event.preventDefault()
        togglePlay()
        return
      }
      if (key === 'ArrowLeft') {
        event.preventDefault()
        seekTo(seekTarget(video.currentTime, -SEEK_STEP_SECONDS, effectiveDuration))
        return
      }
      if (key === 'ArrowRight') {
        event.preventDefault()
        seekTo(seekTarget(video.currentTime, SEEK_STEP_SECONDS, effectiveDuration))
        return
      }
      if (key === 'ArrowUp') {
        event.preventDefault()
        changeVolume(video.volume + VOLUME_STEP)
        return
      }
      if (key === 'ArrowDown') {
        event.preventDefault()
        changeVolume(video.volume - VOLUME_STEP)
        return
      }
      if (key === 'm' || key === 'M') {
        event.preventDefault()
        toggleMute()
        return
      }
      if (key === 'f' || key === 'F') {
        event.preventDefault()
        toggleFullscreen()
        return
      }
      if (/^[0-9]$/.test(key)) {
        event.preventDefault()
        seekTo(percentSeekTarget(Number(key), effectiveDuration))
      }
    },
    [
      activeCheckpoint,
      changeVolume,
      effectiveDuration,
      seekTo,
      toggleFullscreen,
      toggleMute,
      togglePlay,
    ],
  )

  // ---- Kaydırıcı (seek bar) ------------------------------------------------
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const draggingRef = React.useRef(false)

  const seekFromPointer = React.useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      if (rect.width === 0) return
      seekTo(timeFromRatio((clientX - rect.left) / rect.width, effectiveDuration))
    },
    [effectiveDuration, seekTo],
  )

  const handleTrackKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const video = videoRef.current
      if (!video) return
      const key = event.key
      if (key === 'Home') {
        event.preventDefault()
        seekTo(0)
      } else if (key === 'End') {
        event.preventDefault()
        seekTo(effectiveDuration)
      }
      // ← / → / ↑ / ↓ kapsayıcının işleyicisine bırakılır: kaydırıcı ve
      // oynatıcı aynı adımı kullansın.
    },
    [effectiveDuration, seekTo],
  )

  const progressPercent = toPercent(currentTime, effectiveDuration)
  const bufferedPercent = toPercent(bufferedEnd, effectiveDuration)

  const seekValueText = fill(p.seekValue, {
    current: formatSpokenTime(currentTime),
    total: formatSpokenTime(effectiveDuration),
  })

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        role="group"
        aria-label={p.label}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="focus-visible:ring-ring group relative w-full overflow-hidden rounded-lg bg-black focus-visible:outline-none focus-visible:ring-2"
      >
        <video
          ref={videoRef}
          poster={posterUrl ?? undefined}
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false)
            void flushProgress()
          }}
          onSeeking={() => {
            seekingRef.current = true
          }}
          onSeeked={() => {
            const video = videoRef.current
            if (video) lastSampleRef.current = video.currentTime
            seekingRef.current = false
            void flushProgress()
          }}
          onEnded={() => {
            setPlaying(false)
            void flushProgress()
          }}
          onError={() => setFailed(true)}
          onClick={togglePlay}
          onVolumeChange={() => {
            const video = videoRef.current
            if (!video) return
            setVolume(clampVolume(video.volume))
            setMuted(video.muted)
          }}
        />

        {failed ? (
          <p
            role="alert"
            className="bg-background/90 text-foreground absolute inset-x-0 bottom-16 mx-auto w-fit rounded-md px-3 py-2 text-sm"
          >
            {strings.playerError}
          </p>
        ) : null}

        {/* Denetim çubuğu. Videonun üstünde durur, tam ekranda da görünür. */}
        <div className="absolute inset-x-0 bottom-0 space-y-1 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-8 sm:px-3">
          <div className="flex items-center gap-2">
            <span className="text-primary-foreground w-14 shrink-0 text-xs tabular-nums">
              <span className="sr-only">{p.elapsed}: </span>
              {formatClock(currentTime)}
            </span>

            <div
              ref={trackRef}
              role="slider"
              tabIndex={0}
              aria-label={p.seek}
              aria-valuemin={0}
              aria-valuemax={Math.floor(effectiveDuration)}
              aria-valuenow={Math.floor(currentTime)}
              aria-valuetext={seekValueText}
              onKeyDown={handleTrackKeyDown}
              onPointerDown={(event) => {
                draggingRef.current = true
                event.currentTarget.setPointerCapture(event.pointerId)
                seekFromPointer(event.clientX)
              }}
              onPointerMove={(event) => {
                if (draggingRef.current) seekFromPointer(event.clientX)
              }}
              onPointerUp={(event) => {
                draggingRef.current = false
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              className="focus-visible:ring-ring relative h-6 flex-1 cursor-pointer touch-none select-none rounded focus-visible:outline-none focus-visible:ring-2"
            >
              <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
                <div
                  aria-hidden="true"
                  className="h-full bg-white/40"
                  style={{ width: `${bufferedPercent}%` }}
                />
              </div>
              <div
                aria-hidden="true"
                className="bg-primary absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                aria-hidden="true"
                className="border-primary absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
                style={{ left: `${progressPercent}%` }}
              />

              {/* Checkpoint işaretleri */}
              {checkpoints.map((checkpoint) => (
                <span
                  key={checkpoint.id}
                  title={fill(p.checkpointTick, {
                    time: formatSpokenTime(checkpoint.timestampSeconds),
                  })}
                  className="bg-mastery-medium absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full"
                  style={{ left: `${toPercent(checkpoint.timestampSeconds, effectiveDuration)}%` }}
                >
                  <span className="sr-only">
                    {fill(p.checkpointTick, {
                      time: formatSpokenTime(checkpoint.timestampSeconds),
                    })}
                  </span>
                </span>
              ))}
            </div>

            <span className="text-primary-foreground w-14 shrink-0 text-right text-xs tabular-nums">
              <span className="sr-only">{p.total}: </span>
              {formatClock(effectiveDuration)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <ControlButton label={playing ? p.pause : p.play} onClick={togglePlay}>
              {playing ? (
                <Pause aria-hidden="true" className="size-4" />
              ) : (
                <Play aria-hidden="true" className="size-4" />
              )}
            </ControlButton>

            <ControlButton
              label={p.rewind}
              onClick={() =>
                seekTo(
                  seekTarget(
                    videoRef.current?.currentTime ?? 0,
                    -SEEK_STEP_SECONDS,
                    effectiveDuration,
                  ),
                )
              }
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </ControlButton>

            <ControlButton
              label={p.forward}
              onClick={() =>
                seekTo(
                  seekTarget(
                    videoRef.current?.currentTime ?? 0,
                    SEEK_STEP_SECONDS,
                    effectiveDuration,
                  ),
                )
              }
            >
              <RotateCw aria-hidden="true" className="size-4" />
            </ControlButton>

            <ControlButton label={muted ? p.unmute : p.mute} onClick={toggleMute}>
              {muted || volume === 0 ? (
                <VolumeX aria-hidden="true" className="size-4" />
              ) : (
                <Volume2 aria-hidden="true" className="size-4" />
              )}
            </ControlButton>

            <Slider
              aria-label={p.volume}
              className="mx-1 w-20"
              min={0}
              max={100}
              step={5}
              value={[Math.round((muted ? 0 : volume) * 100)]}
              onValueChange={(next) => changeVolume((next[0] ?? 0) / 100)}
            />

            <span className="flex-1" />

            <Select value={String(rate)} onValueChange={(value) => changeRate(Number(value))}>
              <SelectTrigger
                aria-label={p.rate}
                size="sm"
                className="text-primary-foreground h-8 w-[5.5rem] border-white/30 bg-white/10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYBACK_RATES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {fill(p.rateValue, { rate: formatRate(value) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ShortcutsHelp strings={strings} />

            <ControlButton
              label={fullscreen ? p.exitFullscreen : p.fullscreen}
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <Minimize aria-hidden="true" className="size-4" />
              ) : (
                <Maximize aria-hidden="true" className="size-4" />
              )}
            </ControlButton>
          </div>
        </div>

        {activeCheckpoint ? (
          <CheckpointOverlay
            checkpoint={activeCheckpoint}
            strings={strings}
            onResume={() => {
              setActiveCheckpoint(null)
              const video = videoRef.current
              if (video && resumeAfterCheckpointRef.current) {
                void video.play().catch(() => {})
              }
              resumeAfterCheckpointRef.current = false
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'text-primary-foreground/90 hover:text-primary-foreground focus-visible:ring-ring',
        'inline-flex size-8 items-center justify-center rounded-md hover:bg-white/10',
        'focus-visible:outline-none focus-visible:ring-2',
      )}
    >
      {children}
    </button>
  )
}
