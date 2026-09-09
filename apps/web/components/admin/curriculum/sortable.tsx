'use client'

import * as React from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@zihin/ui/lib/utils'
import { fill, t } from '@/lib/i18n/admin'

/**
 * Sürükle bırak sıralama — KLAVYEYLE DE ÇALIŞIR.
 *
 * `KeyboardSensor` tutamağı odaklanabilir bir düğme yapar: boşluk tuşu
 * kaldırır, ok tuşları taşır, boşluk bırakır, Esc iptal eder. Ayrıca her
 * satırın menüsünde "Yukarı taşı" / "Aşağı taşı" var — fare de klavye de
 * kullanmayan (ya da ekran okuyucuyla gezen) editör için sürükleme hiçbir
 * zaman TEK yol değildir.
 *
 * `announcements` Türkçe: dnd-kit'in varsayılan duyuruları İngilizcedir ve
 * ekran okuyucuya öyle gider.
 */

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable: t('admin.dragHint'),
}

function buildAnnouncements(labelOf: (id: string) => string): Announcements {
  return {
    onDragStart: ({ active }) => `${labelOf(String(active.id))} kaldırıldı.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${labelOf(String(active.id))}, ${labelOf(String(over.id))} konumuna taşınıyor.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelOf(String(active.id))}, ${labelOf(String(over.id))} konumuna bırakıldı.`
        : `${labelOf(String(active.id))} bırakıldı.`,
    onDragCancel: ({ active }) => `${labelOf(String(active.id))} taşıması iptal edildi.`,
  }
}

type SortableGroupProps = {
  /** Kardeşlerin GÖRÜNEN sırası. */
  ids: string[]
  labelOf: (id: string) => string
  /** Bırakma sonrası hedef konum (0 tabanlı). */
  onMove: (id: string, toIndex: number) => void
  children: React.ReactNode
}

export function SortableGroup({ ids, labelOf, onMove, children }: SortableGroupProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const announcements = React.useMemo(() => buildAnnouncements(labelOf), [labelOf])

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const toIndex = ids.indexOf(String(over.id))
    if (toIndex === -1) return
    onMove(String(active.id), toIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1">{children}</ul>
      </SortableContext>
    </DndContext>
  )
}

type SortableRowProps = {
  id: string
  label: string
  children: React.ReactNode
  className?: string
}

/** Tek satır: solda tutamak, sağında satırın kendi içeriği. */
export function SortableRow({ id, label, children, className }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('list-none', isDragging && 'relative z-10 opacity-90', className)}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={fill(t('admin.dragHandle'), { name: label })}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mt-1.5 cursor-grab rounded p-1 focus-visible:outline-none focus-visible:ring-[3px]"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </li>
  )
}
