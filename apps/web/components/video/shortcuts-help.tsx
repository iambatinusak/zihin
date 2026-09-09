'use client'

import { Keyboard } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@zihin/ui/popover'
import type { VideoStrings } from './strings'

/**
 * Kısayolların keşfedilebilir olması için küçük bir yardım balonu.
 * Kısayolların kendisi oynatıcıda (`video-player.tsx`) işlenir; burası
 * yalnızca listeyi gösterir.
 */
export function ShortcutsHelp({ strings }: { strings: VideoStrings }) {
  const s = strings.shortcuts
  const rows: Array<{ keys: string; label: string }> = [
    { keys: `${s.keySpace} / K`, label: s.playPause },
    { keys: s.keyArrows, label: `${s.seekBack} · ${s.seekForward}` },
    { keys: s.keyVolume, label: `${s.volumeUp} · ${s.volumeDown}` },
    { keys: 'M', label: s.mute },
    { keys: 'F', label: s.fullscreen },
    { keys: s.keyDigits, label: s.percent },
  ]

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={s.open}
        title={s.open}
        className="text-primary-foreground/90 hover:text-primary-foreground focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
      >
        <Keyboard aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <h3 className="text-foreground mb-1 text-sm font-semibold">{s.title}</h3>
        <p className="text-muted-foreground mb-3 text-xs">{s.hint}</p>
        <dl className="space-y-1.5 text-xs">
          {rows.map((row) => (
            <div key={row.keys} className="flex items-start gap-3">
              <dt className="border-border bg-muted text-foreground shrink-0 rounded border px-1.5 py-0.5 font-mono">
                {row.keys}
              </dt>
              <dd className="text-muted-foreground min-w-0 flex-1">{row.label}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}
