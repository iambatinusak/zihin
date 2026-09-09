'use client'

import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zihin/ui/tabs'
import { VideoPlayer, type PlayerCheckpoint, type VideoPlayerHandle } from './video-player'
import { VideoNotes, type NoteItem } from './video-notes'
import type { VideoStrings } from './strings'

/**
 * Oynatıcı ile yan paneli birbirine bağlayan istemci kabuğu.
 *
 * Neden ayrı bir bileşen: notların "şu anki konum"a not eklemesi ve bir nota
 * tıklandığında videonun o ana atlaması için ikisinin aynı oynatıcı örneğini
 * görmesi gerekir. Kazanımlar ve hafıza notu ise sunucuda üretilip buraya
 * hazır düğüm olarak geçirilir — Markdown ve KaTeX istemciye taşınmaz.
 */

type VideoWorkspaceProps = {
  videoId: string
  src: string
  durationSeconds: number
  posterUrl: string | null
  startAtSeconds: number
  initialWatchedSeconds: number
  alreadyCompleted: boolean
  checkpoints: PlayerCheckpoint[]
  initialNotes: NoteItem[]
  strings: VideoStrings
  /** Sunucuda basılmış kazanım listesi. */
  outcomesSlot: React.ReactNode
  /** Sunucuda basılmış hafıza notu. */
  memoryNoteSlot: React.ReactNode
}

export function VideoWorkspace({
  videoId,
  src,
  durationSeconds,
  posterUrl,
  startAtSeconds,
  initialWatchedSeconds,
  alreadyCompleted,
  checkpoints,
  initialNotes,
  strings,
  outcomesSlot,
  memoryNoteSlot,
}: VideoWorkspaceProps) {
  const playerRef = React.useRef<VideoPlayerHandle | null>(null)

  const seekTo = React.useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds)
  }, [])

  const getCurrentTime = React.useCallback(() => playerRef.current?.currentTime() ?? 0, [])

  return (
    // Mobilde tek sütun (oynatıcı üstte), geniş ekranda oynatıcı solda.
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <VideoPlayer
          handleRef={playerRef}
          videoId={videoId}
          src={src}
          durationSeconds={durationSeconds}
          posterUrl={posterUrl}
          startAtSeconds={startAtSeconds}
          initialWatchedSeconds={initialWatchedSeconds}
          alreadyCompleted={alreadyCompleted}
          checkpoints={checkpoints}
          strings={strings}
        />
      </div>

      <aside aria-label={strings.sidePanel} className="min-w-0">
        <Tabs defaultValue="notes" className="gap-4">
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="notes">{strings.tabs.notes}</TabsTrigger>
            <TabsTrigger value="outcomes">{strings.tabs.outcomes}</TabsTrigger>
            <TabsTrigger value="memory-note">{strings.tabs.memoryNote}</TabsTrigger>
          </TabsList>

          <TabsContent value="notes">
            <VideoNotes
              videoId={videoId}
              initialNotes={initialNotes}
              strings={strings}
              onSeek={seekTo}
              getCurrentTime={getCurrentTime}
            />
          </TabsContent>

          <TabsContent value="outcomes">{outcomesSlot}</TabsContent>
          <TabsContent value="memory-note">{memoryNoteSlot}</TabsContent>
        </Tabs>
      </aside>
    </div>
  )
}
