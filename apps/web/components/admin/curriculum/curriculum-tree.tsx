'use client'

import * as React from 'react'
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@zihin/ui/badge'
import { Button } from '@zihin/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zihin/ui/dropdown-menu'
import { cn } from '@zihin/ui/lib/utils'
import { fill, t } from '@/lib/i18n/admin'
import { neighborIndex } from '@/lib/admin/reorder'
import { reorderNodes } from '@/app/(admin)/admin/mufredat/actions'
import type { CurriculumExam } from '@/lib/data/admin'
import { DeleteNodeDialog } from './delete-node-dialog'
import { NodeFormDialog, type FormTarget } from './node-form-dialog'
import { SortableGroup, SortableRow } from './sortable'
import {
  childKind,
  moveInArray,
  nodeLabel,
  toExamNodes,
  type AnyNode,
  type ExamNode,
  type SubjectNode,
  type UnitNode,
} from './types'

/**
 * Müfredat ağacı düzenleyicisi (spec §M15).
 *
 * Ağaç istemcide tutulur ve taşıma İYİMSER uygulanır: satır anında yerine
 * gider, action arka planda yazar, hata dönerse eski sıra geri konur ve
 * kullanıcı bunu bir bildirimle görür. Sunucudan yeni ağaç geldiğinde
 * (revalidate) yerel durum tazelenir.
 *
 * Sıralama üç yoldan yapılabilir ve ÜÇÜ DE aynı action'a gider:
 * sürükleme, klavye tutamağı (dnd-kit `KeyboardSensor`) ve satır menüsündeki
 * "Yukarı taşı" / "Aşağı taşı".
 */
export function CurriculumTree({ tree }: { tree: CurriculumExam[] }) {
  const [exams, setExams] = React.useState<ExamNode[]>(() => toExamNodes(tree))
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => new Set())
  const [formTarget, setFormTarget] = React.useState<FormTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<AnyNode | null>(null)
  const [, startTransition] = React.useTransition()

  // Sunucu yeni ağaç gönderdiğinde (kaydetme/silme sonrası revalidate)
  // iyimser yerel durum terk edilir; kaynak her zaman sunucudur.
  React.useEffect(() => {
    setExams(toExamNodes(tree))
  }, [tree])

  const toggle = React.useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /** Tek taşıma yolu: iyimser güncelle → yaz → hata olursa geri al. */
  const move = React.useCallback(
    (node: AnyNode, toIndex: number) => {
      const previous = exams
      const optimistic = applyMove(exams, node, toIndex)
      if (optimistic === null) return

      setExams(optimistic)
      startTransition(async () => {
        const result = await reorderNodes({
          level: node.kind,
          ...(node.parentId === null ? {} : { parentId: node.parentId }),
          movedId: node.id,
          toIndex,
        })
        if (!result.ok) {
          setExams(previous)
          toast.error(result.error.message)
        }
      })
    },
    [exams],
  )

  const onSaved = React.useCallback((message: string) => toast.success(message), [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground max-w-2xl text-sm">{t('admin.curriculumHelp')}</p>
        <Button
          size="sm"
          onClick={() => setFormTarget({ mode: 'create', kind: 'exam', parentId: null })}
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('admin.addExam')}
        </Button>
      </div>

      <SortableGroup
        ids={exams.map((exam) => exam.id)}
        labelOf={(id) => exams.find((exam) => exam.id === id)?.name ?? ''}
        onMove={(id, toIndex) => {
          const exam = exams.find((item) => item.id === id)
          if (exam) move(exam, toIndex)
        }}
      >
        {exams.map((exam) => (
          <SortableRow key={exam.id} id={exam.id} label={exam.name}>
            <NodeRow
              node={exam}
              siblings={exams}
              expanded={expanded}
              onToggle={toggle}
              onMove={move}
              onEdit={(target) => setFormTarget({ mode: 'edit', node: target })}
              onDelete={setDeleteTarget}
              onCreateChild={(parentId, kind) => setFormTarget({ mode: 'create', kind, parentId })}
            />
          </SortableRow>
        ))}
      </SortableGroup>

      <NodeFormDialog target={formTarget} onClose={() => setFormTarget(null)} onSaved={onSaved} />
      <DeleteNodeDialog
        node={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={onSaved}
      />
    </div>
  )
}

/* ───────────────────────────── Tek satır ────────────────────────────────── */

type RowHandlers = {
  expanded: ReadonlySet<string>
  onToggle: (id: string) => void
  onMove: (node: AnyNode, toIndex: number) => void
  onEdit: (node: AnyNode) => void
  onDelete: (node: AnyNode) => void
  onCreateChild: (parentId: string, kind: 'subject' | 'unit' | 'topic') => void
}

type NodeRowProps = RowHandlers & {
  node: AnyNode
  siblings: AnyNode[]
}

const KIND_LABEL: Record<AnyNode['kind'], string> = {
  exam: 'admin.levelExam',
  subject: 'admin.levelSubject',
  unit: 'admin.levelUnit',
  topic: 'admin.levelTopic',
}

const ADD_LABEL = {
  subject: 'admin.addSubject',
  unit: 'admin.addUnit',
  topic: 'admin.addTopic',
} as const

function NodeRow({ node, siblings, ...handlers }: NodeRowProps) {
  const { expanded, onToggle, onMove, onEdit, onDelete, onCreateChild } = handlers
  const label = nodeLabel(node)
  const nextKind = childKind(node.kind)
  const children = node.kind === 'topic' ? [] : node.children
  const isOpen = expanded.has(node.id)

  const orderables = siblings.map((sibling) => ({ id: sibling.id, orderIndex: 0 }))
  const upIndex = neighborIndex(orderables, node.id, 'up')
  const downIndex = neighborIndex(orderables, node.id, 'down')

  return (
    <div className="border-border bg-card rounded-md border">
      <div className="flex items-center gap-2 px-2 py-2">
        {nextKind === null ? (
          <span className="size-7" aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={isOpen}
            aria-label={fill(t(isOpen ? 'admin.collapse' : 'admin.expand'), { name: label })}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded p-1 focus-visible:outline-none focus-visible:ring-[3px]"
          >
            {isOpen ? (
              <ChevronDown aria-hidden="true" className="size-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4" />
            )}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-muted-foreground truncate text-xs">
            {t(KIND_LABEL[node.kind])}
            {node.kind !== 'exam' ? ` · ${node.slug}` : ` · ${node.code}`}
            {node.kind === 'topic'
              ? ` · ${node.estimatedMinutes} dk · zorluk ${node.difficulty}`
              : ''}
          </p>
        </div>

        {node.kind === 'exam' && !node.isActive ? (
          <Badge variant="outline">Yayında değil</Badge>
        ) : null}
        {nextKind !== null ? (
          <Badge variant="secondary">
            {fill(t('admin.childCount'), { count: children.length })}
          </Badge>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={fill(t('admin.rowMenu'), { name: label })}
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(node)}>{t('admin.edit')}</DropdownMenuItem>
            {nextKind !== null ? (
              <DropdownMenuItem onSelect={() => onCreateChild(node.id, nextKind)}>
                {t(ADD_LABEL[nextKind])}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            {/* Sürükle bırakın klavye karşılığı; dnd-kit tutamağı da çalışır. */}
            <DropdownMenuItem
              disabled={upIndex === null}
              onSelect={() => (upIndex === null ? undefined : onMove(node, upIndex))}
            >
              {t('admin.moveUp')}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={downIndex === null}
              onSelect={() => (downIndex === null ? undefined : onMove(node, downIndex))}
            >
              {t('admin.moveDown')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onDelete(node)}
            >
              {t('admin.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isOpen && nextKind !== null ? (
        <div className={cn('border-border border-t px-2 py-2 pl-6')}>
          {children.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-xs">{t('admin.noChildren')}</p>
          ) : (
            <SortableGroup
              ids={children.map((child) => child.id)}
              labelOf={(id) => {
                const found = children.find((child) => child.id === id)
                return found ? nodeLabel(found) : ''
              }}
              onMove={(id, toIndex) => {
                const child = children.find((item) => item.id === id)
                if (child) onMove(child, toIndex)
              }}
            >
              {children.map((child) => (
                <SortableRow key={child.id} id={child.id} label={nodeLabel(child)}>
                  <NodeRow
                    node={child}
                    siblings={children}
                    expanded={expanded}
                    onToggle={onToggle}
                    onMove={onMove}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCreateChild={onCreateChild}
                  />
                </SortableRow>
              ))}
            </SortableGroup>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* ─────────────────────── İyimser taşıma (saf) ───────────────────────────── */

/**
 * Taşımayı yerel ağaca uygular. Düğüm bulunamazsa `null` döner ve çağıran
 * hiçbir şey yapmaz — ekranda görünmeyen bir satırı taşımaya çalışmak sessiz
 * bir bozulma olurdu.
 */
function applyMove(exams: ExamNode[], node: AnyNode, toIndex: number): ExamNode[] | null {
  if (node.kind === 'exam') {
    const from = exams.findIndex((item) => item.id === node.id)
    if (from === -1) return null
    return moveInArray(exams, from, toIndex)
  }

  if (node.kind === 'subject') {
    return mapExam(exams, node.parentId, (exam) => ({
      ...exam,
      children: reorderChildren(exam.children, node.id, toIndex),
    }))
  }

  if (node.kind === 'unit') {
    return mapSubject(exams, node.parentId, (subject) => ({
      ...subject,
      children: reorderChildren(subject.children, node.id, toIndex),
    }))
  }

  return mapUnit(exams, node.parentId, (unit) => ({
    ...unit,
    children: reorderChildren(unit.children, node.id, toIndex),
  }))
}

function reorderChildren<T extends { id: string }>(items: T[], id: string, toIndex: number): T[] {
  const from = items.findIndex((item) => item.id === id)
  if (from === -1) return items
  return moveInArray(items, from, toIndex)
}

function mapExam(exams: ExamNode[], examId: string, map: (exam: ExamNode) => ExamNode): ExamNode[] {
  return exams.map((exam) => (exam.id === examId ? map(exam) : exam))
}

function mapSubject(
  exams: ExamNode[],
  subjectId: string,
  map: (subject: SubjectNode) => SubjectNode,
): ExamNode[] {
  return exams.map((exam) => ({
    ...exam,
    children: exam.children.map((subject) => (subject.id === subjectId ? map(subject) : subject)),
  }))
}

function mapUnit(exams: ExamNode[], unitId: string, map: (unit: UnitNode) => UnitNode): ExamNode[] {
  return exams.map((exam) => ({
    ...exam,
    children: exam.children.map((subject) => ({
      ...subject,
      children: subject.children.map((unit) => (unit.id === unitId ? map(unit) : unit)),
    })),
  }))
}
