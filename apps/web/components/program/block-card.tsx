'use client'

import * as React from 'react'
import Link from 'next/link'
import { useDraggable } from '@dnd-kit/core'
import {
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  ClipboardList,
  GripVertical,
  Layers,
  Loader2,
  PlayCircle,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import { Button } from '@zihin/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@zihin/ui/dropdown-menu'
import { cn } from '@zihin/ui/lib/utils'
import { StartTestButton } from '@/components/test/start-test-button'
import type { StudyBlockItem } from '@/lib/data/plan'
import { blockVisual } from './block-visuals'
import { minutesLabel, weekdayLabel } from './format'
import type { ProgramStrings } from './strings'

const TYPE_ICONS = {
  watch: PlayCircle,
  solve: ClipboardList,
  review: Layers,
  mock: RotateCcw,
} as const

type BlockCardProps = {
  block: StudyBlockItem
  strings: ProgramStrings
  /** Haftanın yedi günü — "Başka güne taşı" menüsü buradan doldurulur. */
  weekDays: string[]
  /** Geçmiş hafta salt okunurdur; sürükleme ve işaretleme kapanır. */
  readOnly: boolean
  pending: boolean
  onToggleComplete: (block: StudyBlockItem) => void
  onMove: (block: StudyBlockItem, toDate: string) => void
}

/**
 * Tek çalışma bloğu.
 *
 * SÜRÜKLEME TEK YOL DEĞİLDİR: her kartta "Başka güne taşı" menüsü vardır ve
 * sürükleme ile TAM AYNI action'ı çağırır. Sürükle-bırak yalnızca fare
 * kullanan için bir kısayol; klavye ve ekran okuyucu kullanan öğrenci menüyle
 * aynı işi yapar (CONVENTIONS §8).
 */
export function BlockCard({
  block,
  strings,
  weekDays,
  readOnly,
  pending,
  onToggleComplete,
  onMove,
}: BlockCardProps) {
  const visual = blockVisual(block.type)
  const Icon = TYPE_ICONS[block.type] ?? PlayCircle
  const completed = block.completedAt !== null
  const draggable = !readOnly && !completed

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    disabled: !draggable,
  })

  const typeLabel = strings.blockTypes[block.type] ?? ''

  return (
    <li
      ref={setNodeRef}
      className={cn(
        'bg-card border-border rounded-md border border-l-4 p-3 shadow-sm transition-opacity',
        visual.borderClass,
        completed && 'opacity-70',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2">
        {draggable ? (
          <button
            type="button"
            // Sürükleme tutamacı yardımcı teknolojiden gizlenir: aynı işi yapan
            // erişilebilir yol "Başka güne taşı" menüsüdür, iki kez duyurulmaz.
            className="text-muted-foreground hover:text-foreground mt-0.5 cursor-grab touch-none"
            title={strings.dragHandle}
            {...attributes}
            {...listeners}
            aria-hidden="true"
            tabIndex={-1}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn('gap-1 border-transparent font-medium', visual.chipClass)}
            >
              <Icon aria-hidden="true" className={cn('size-3.5', visual.iconClass)} />
              {typeLabel}
            </Badge>
            <span className="text-muted-foreground text-xs tabular-nums">
              {minutesLabel(block.estimatedMinutes, strings.minutesShort)}
            </span>
            {block.movedFromDate ? (
              <span className="text-muted-foreground text-xs">
                · {weekdayLabel(block.movedFromDate, strings)} {strings.movedFrom}
              </span>
            ) : null}
          </div>

          <p className={cn('text-foreground text-sm font-medium', completed && 'line-through')}>
            {block.title}
          </p>

          {block.topic ? (
            <Link
              href={`/dersler/${block.topic.subjectSlug}/${block.topic.unitSlug}/${block.topic.slug}`}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            >
              {block.topic.subjectName}
            </Link>
          ) : null}

          <BlockAction block={block} strings={strings} />

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button
              type="button"
              size="sm"
              variant={completed ? 'secondary' : 'outline'}
              disabled={readOnly || pending}
              aria-busy={pending}
              aria-pressed={completed}
              onClick={() => onToggleComplete(block)}
            >
              {pending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : completed ? (
                <CheckCircle2 aria-hidden="true" className="size-4" />
              ) : (
                <Circle aria-hidden="true" className="size-4" />
              )}
              {completed ? strings.uncomplete : strings.complete}
            </Button>

            {readOnly || completed ? null : (
              <MoveMenu
                block={block}
                strings={strings}
                weekDays={weekDays}
                disabled={pending}
                onMove={onMove}
              />
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

/** Bloğu asıl işine götüren bağlantı. İçerik yoksa kart yine durur. */
function BlockAction({ block, strings }: { block: StudyBlockItem; strings: ProgramStrings }) {
  if (block.type === 'watch') {
    if (!block.videoId) return <ContentPending strings={strings} />
    return (
      <Link
        href={`/video/${block.videoId}`}
        className="text-primary text-xs font-medium underline-offset-2 hover:underline"
      >
        {strings.watchAction}
      </Link>
    )
  }

  if (block.type === 'solve') {
    if (!block.testId) return <ContentPending strings={strings} />
    return (
      <StartTestButton input={{ testId: block.testId }} size="sm" variant="outline">
        {strings.solveAction}
      </StartTestButton>
    )
  }

  if (block.type === 'review') {
    return (
      <Link
        href="/kartlar"
        className="text-primary text-xs font-medium underline-offset-2 hover:underline"
      >
        {strings.reviewAction}
      </Link>
    )
  }

  return (
    <Link
      href="/deneme"
      className="text-primary text-xs font-medium underline-offset-2 hover:underline"
    >
      {strings.mockAction}
    </Link>
  )
}

/**
 * 1164 konunun yalnızca birkaçında video/test var. Bloğu programdan düşürmek
 * yerine burada dürüstçe söylenir: iş planda kalır, bağlantısı yoktur.
 */
function ContentPending({ strings }: { strings: ProgramStrings }) {
  return (
    <p className="text-muted-foreground text-xs">
      <span className="font-medium">{strings.contentPendingTitle}:</span> {strings.contentPending}
    </p>
  )
}

function MoveMenu({
  block,
  strings,
  weekDays,
  disabled,
  onMove,
}: {
  block: StudyBlockItem
  strings: ProgramStrings
  weekDays: string[]
  disabled: boolean
  onMove: (block: StudyBlockItem, toDate: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="ghost" disabled={disabled}>
          <ArrowRightLeft aria-hidden="true" className="size-4" />
          {strings.moveMenu}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{strings.moveMenuLabel}</DropdownMenuLabel>
        {weekDays
          .filter((date) => date !== block.scheduledDate)
          .map((date) => (
            <DropdownMenuItem key={date} onSelect={() => onMove(block, date)}>
              {weekdayLabel(date, strings)}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
