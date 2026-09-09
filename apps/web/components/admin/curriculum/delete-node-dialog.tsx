'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
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
import { fill, t } from '@/lib/i18n/admin'
import { previewDeleteImpact, softDeleteNode } from '@/app/(admin)/admin/mufredat/actions'
import type { DeleteImpact } from '@/lib/data/admin'
import { nodeLabel, type AnyNode } from './types'

/**
 * Yumuşak silme onayı.
 *
 * Kutu açılır açılmaz "ne gizlenecek" sayıları sunucudan çekilir. Sayıyı
 * göstermeden onay istemek, editöre 400 soruyu tek tıkla görünmez yaptırmak
 * demekti; silme geri alınabilir olsa bile fark edilmesi günler sürerdi.
 */
export function DeleteNodeDialog({
  node,
  onClose,
  onDeleted,
}: {
  node: AnyNode | null
  onClose: () => void
  onDeleted: (message: string) => void
}) {
  const [impact, setImpact] = React.useState<DeleteImpact | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  const nodeId = node?.id ?? null
  const nodeKind = node?.kind ?? null

  React.useEffect(() => {
    if (nodeId === null || nodeKind === null) return
    let cancelled = false

    setImpact(null)
    setError(null)
    setLoading(true)

    void previewDeleteImpact({ level: nodeKind, id: nodeId }).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.ok) setImpact(result.data)
      else setError(result.error.message)
    })

    return () => {
      cancelled = true
    }
  }, [nodeId, nodeKind])

  if (node === null) return null

  const lines = impact === null ? [] : impactLines(impact)

  return (
    <AlertDialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {fill(t('admin.deleteTitle'), { name: nodeLabel(node) })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('admin.deleteBody')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="text-sm" aria-live="polite">
          {loading ? (
            <p className="text-muted-foreground flex items-center gap-2">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {t('common.loading')}
            </p>
          ) : null}

          {error ? <p className="text-destructive">{error}</p> : null}

          {impact !== null && lines.length > 0 ? (
            <>
              <p className="mb-1 font-medium">{t('admin.deleteImpactTitle')}</p>
              <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}

          {impact !== null && lines.length === 0 ? (
            <p className="text-muted-foreground">{t('admin.deleteImpactNone')}</p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('admin.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              startTransition(async () => {
                const result = await softDeleteNode({ level: node.kind, id: node.id })
                if (!result.ok) {
                  setError(result.error.message)
                  return
                }
                onDeleted(t('admin.deleted'))
                onClose()
              })
            }}
          >
            {t('admin.deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Sıfır olan satırlar hiç yazılmaz; "0 video" bilgi değil gürültüdür. */
function impactLines(impact: DeleteImpact): string[] {
  const entries: Array<[number, string]> = [
    [impact.subjectCount, 'admin.deleteImpactSubjects'],
    [impact.unitCount, 'admin.deleteImpactUnits'],
    [impact.topicCount, 'admin.deleteImpactTopics'],
    [impact.videoCount, 'admin.deleteImpactVideos'],
    [impact.questionCount, 'admin.deleteImpactQuestions'],
    [impact.flashcardCount, 'admin.deleteImpactFlashcards'],
  ]

  return entries.filter(([count]) => count > 0).map(([count, key]) => fill(t(key), { count }))
}
