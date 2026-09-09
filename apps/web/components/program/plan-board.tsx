'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { cn } from '@zihin/ui/lib/utils'
import { completeBlock, moveBlock, uncompleteBlock } from '@/app/(student)/program/actions'
import type { StudyBlockItem } from '@/lib/data/plan'
import { BlockCard } from './block-card'
import { dayLabel, weekdayLabel } from './format'
import type { ProgramStrings } from './strings'

/**
 * Haftalık program tahtası: yedi gün sütunu, gün içinde blok kartları.
 *
 * SUNUCU SON SÖZÜ SÖYLER. Sürükleme ve işaretleme önce ekranda uygulanır
 * (iyimser), ama `moveBlock` / `completeBlock` reddederse durum GERİ ALINIR ve
 * hata gösterilir. Sessiz başarısızlık yok: öğrenci bloğu taşıdığını sanıp
 * ertesi gün eski yerinde bulmasın.
 *
 * Sürükleme, erişilebilirliğin tek yolu değildir — kartlardaki "Başka güne
 * taşı" menüsü aynı action'ı çağırır (bkz. block-card.tsx).
 */

type PlanBoardProps = {
  weekDays: string[]
  /** Türkiye saatine göre bugün; sütun vurgusu için. */
  today: string
  blocks: StudyBlockItem[]
  strings: ProgramStrings
  /** Geçmiş hafta yalnızca okunur. */
  readOnly: boolean
}

export function PlanBoard({ weekDays, today, blocks, strings, readOnly }: PlanBoardProps) {
  const [items, setItems] = React.useState(blocks)
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set())
  const [draggingId, setDraggingId] = React.useState<string | null>(null)

  // Sunucu yeniden doğruladığında (revalidatePath) taze veriyi al.
  React.useEffect(() => setItems(blocks), [blocks])

  const sensors = useSensors(
    // Küçük hareketler tıklama sayılır; kartın içindeki düğmeler sürüklemeye
    // takılmasın diye eşik konur.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  function markPending(id: string, value: boolean): void {
    setPendingIds((current) => {
      const next = new Set(current)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function applyMove(block: StudyBlockItem, toDate: string): Promise<void> {
    if (readOnly || block.scheduledDate === toDate || block.completedAt) return

    const previousDate = block.scheduledDate
    setItems((current) =>
      current.map((item) => (item.id === block.id ? { ...item, scheduledDate: toDate } : item)),
    )
    markPending(block.id, true)

    try {
      const result = await moveBlock({ blockId: block.id, toDate })
      if (result.ok) {
        setItems((current) =>
          current.map((item) =>
            item.id === block.id
              ? {
                  ...item,
                  scheduledDate: result.data.scheduledDate,
                  orderIndex: result.data.orderIndex,
                  movedFromDate: result.data.movedFromDate,
                }
              : item,
          ),
        )
        toast.success(strings.moved)
      } else {
        revertDate(block.id, previousDate)
        toast.error(result.error.message)
      }
    } catch {
      revertDate(block.id, previousDate)
      toast.error(strings.moveFailed)
    } finally {
      markPending(block.id, false)
    }
  }

  function revertDate(blockId: string, date: string): void {
    setItems((current) =>
      current.map((item) => (item.id === blockId ? { ...item, scheduledDate: date } : item)),
    )
  }

  async function toggleComplete(block: StudyBlockItem): Promise<void> {
    if (readOnly) return

    const wasCompleted = block.completedAt !== null
    const optimistic = wasCompleted ? null : new Date().toISOString()
    setItems((current) =>
      current.map((item) => (item.id === block.id ? { ...item, completedAt: optimistic } : item)),
    )
    markPending(block.id, true)

    try {
      const result = wasCompleted
        ? await uncompleteBlock({ blockId: block.id })
        : await completeBlock({ blockId: block.id })

      if (result.ok) {
        if (wasCompleted) {
          toast.success(strings.uncompletedToast)
        } else {
          const data: unknown = result.data
          const awarded =
            typeof data === 'object' &&
            data !== null &&
            'awardedXp' in data &&
            typeof (data as { awardedXp: unknown }).awardedXp === 'number'
              ? (data as { awardedXp: number }).awardedXp
              : 0
          toast.success(
            awarded > 0
              ? `${strings.completedToast} +${awarded} ${strings.xpAwarded}`
              : strings.completedToast,
          )
        }
      } else {
        revertCompletion(block.id, block.completedAt)
        toast.error(result.error.message)
      }
    } catch {
      revertCompletion(block.id, block.completedAt)
      toast.error(strings.completeFailed)
    } finally {
      markPending(block.id, false)
    }
  }

  function revertCompletion(blockId: string, completedAt: string | null): void {
    setItems((current) =>
      current.map((item) => (item.id === blockId ? { ...item, completedAt } : item)),
    )
  }

  function onDragStart(event: DragStartEvent): void {
    setDraggingId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent): void {
    setDraggingId(null)
    const overId = event.over?.id
    if (overId === undefined) return

    const block = items.find((item) => item.id === String(event.active.id))
    if (!block) return
    void applyMove(block, String(overId))
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => announceFor(items, strings, String(active.id), 'start'),
    onDragOver: ({ active, over }) =>
      over ? announceMove(items, strings, String(active.id), String(over.id)) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? announceMove(items, strings, String(active.id), String(over.id)) : undefined,
    onDragCancel: ({ active }) => announceFor(items, strings, String(active.id), 'cancel'),
  }

  const dragged = draggingId ? items.find((item) => item.id === draggingId) : undefined

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: strings.dragInstructions },
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {weekDays.map((date) => (
          <DayColumn
            key={date}
            date={date}
            isToday={date === today}
            strings={strings}
            blocks={items.filter((item) => item.scheduledDate === date)}
            weekDays={weekDays}
            readOnly={readOnly}
            pendingIds={pendingIds}
            onToggleComplete={(block) => void toggleComplete(block)}
            onMove={(block, toDate) => void applyMove(block, toDate)}
          />
        ))}
      </div>

      <DragOverlay>
        {dragged ? (
          <div className="bg-card border-border rounded-md border px-3 py-2 text-sm shadow-lg">
            {dragged.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function DayColumn({
  date,
  isToday,
  blocks,
  strings,
  weekDays,
  readOnly,
  pendingIds,
  onToggleComplete,
  onMove,
}: {
  date: string
  isToday: boolean
  blocks: StudyBlockItem[]
  strings: ProgramStrings
  weekDays: string[]
  readOnly: boolean
  pendingIds: ReadonlySet<string>
  onToggleComplete: (block: StudyBlockItem) => void
  onMove: (block: StudyBlockItem, toDate: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date, disabled: readOnly })
  const totalMinutes = blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0)
  const completed = blocks.filter((block) => block.completedAt !== null).length

  return (
    <section
      ref={setNodeRef}
      aria-label={`${weekdayLabel(date, strings)} ${dayLabel(date, strings)}`}
      className={cn(
        'border-border flex min-h-32 flex-col gap-2 rounded-lg border p-2 transition-colors',
        isToday && 'border-primary/60 bg-accent/30',
        isOver && 'border-primary bg-accent/60',
      )}
    >
      <header className="flex items-baseline justify-between gap-2 px-1">
        <div>
          <h3 className="text-foreground text-sm font-semibold">{weekdayLabel(date, strings)}</h3>
          <p className="text-muted-foreground text-xs">{dayLabel(date, strings)}</p>
        </div>
        {blocks.length > 0 ? (
          <p className="text-muted-foreground text-right text-xs tabular-nums">
            {completed}/{blocks.length}
            <span className="sr-only"> {strings.summaryCompleted}</span>
            <br />
            {totalMinutes} {strings.minutesShort}
          </p>
        ) : null}
      </header>

      {blocks.length === 0 ? (
        <p className="text-muted-foreground px-1 py-4 text-center text-xs">
          {isOver ? strings.dropHere : strings.emptyDayTitle}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              strings={strings}
              weekDays={weekDays}
              readOnly={readOnly}
              pending={pendingIds.has(block.id)}
              onToggleComplete={onToggleComplete}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Basit yer tutucu doldurma: metin sözlükte, birleştirme burada. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

function announceFor(
  items: readonly StudyBlockItem[],
  strings: ProgramStrings,
  blockId: string,
  phase: 'start' | 'cancel',
): string | undefined {
  const block = items.find((item) => item.id === blockId)
  if (!block) return undefined
  const template = phase === 'start' ? strings.announceGrabbed : strings.announceCancelled
  return fill(template, { title: block.title })
}

function announceMove(
  items: readonly StudyBlockItem[],
  strings: ProgramStrings,
  blockId: string,
  date: string,
): string | undefined {
  const block = items.find((item) => item.id === blockId)
  if (!block) return undefined
  return fill(strings.announceOver, { title: block.title, day: weekdayLabel(date, strings) })
}
