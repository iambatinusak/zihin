'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { Input } from '@zihin/ui/input'
import { Textarea } from '@zihin/ui/textarea'
import { Switch } from '@zihin/ui/switch'
import { Button } from '@zihin/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@zihin/ui/dialog'
import {
  Field,
  FormErrorSummary,
  SubmitButton,
  type FieldErrors,
} from '@/components/common/form-parts'
import { fill, t } from '@/lib/i18n/admin'
import { saveExam, saveSubject, saveTopic, saveUnit } from '@/app/(admin)/admin/mufredat/actions'
import type { AnyNode } from './types'

/**
 * Dört düzeyin ortak düzenleme kutusu.
 *
 * Tek bileşen: alanlar düzeye göre değişiyor ama akış (gönder → `ActionResult`
 * → alan hataları) birebir aynı. Dört ayrı kopya, hata gösteriminin dört ayrı
 * biçimde ayrışması demekti.
 *
 * Doğrulamanın tamamı sunucuda; buradaki `required` / `min` yalnızca kullanıcı
 * kolaylığıdır.
 */

/**
 * Hafıza notu önizlemesi TEMBEL yüklenir.
 *
 * `Markdown` bileşeni KaTeX ve rehype-sanitize taşıyor; bunlar yalnızca konu
 * düzenleyen editörün ihtiyacı. `next/dynamic` ile ayrı bir parçaya alınıyor,
 * böylece paylaşılan istemci paketine girmiyor (CONVENTIONS: Markdown sunucuda
 * basılır — canlı önizleme bilinçli tek istisnadır).
 */
const MarkdownPreview = dynamic(
  () => import('@/components/common/markdown').then((module) => module.Markdown),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground text-xs">{t('admin.previewLoading')}</p>,
  },
)

export type FormTarget =
  | { mode: 'create'; kind: 'exam'; parentId: null }
  | { mode: 'create'; kind: 'subject' | 'unit' | 'topic'; parentId: string }
  | { mode: 'edit'; node: AnyNode }

type NodeFormDialogProps = {
  target: FormTarget | null
  onClose: () => void
  onSaved: (message: string) => void
}

const LEVEL_LABEL: Record<AnyNode['kind'], string> = {
  exam: 'admin.levelExam',
  subject: 'admin.levelSubject',
  unit: 'admin.levelUnit',
  topic: 'admin.levelTopic',
}

export function NodeFormDialog({ target, onClose, onSaved }: NodeFormDialogProps) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [memoryNote, setMemoryNote] = React.useState('')

  const kind = target === null ? null : target.mode === 'edit' ? target.node.kind : target.kind
  const node = target?.mode === 'edit' ? target.node : null

  React.useEffect(() => {
    setError(null)
    setFieldErrors({})
    setMemoryNote(node?.kind === 'topic' ? node.memoryNote : '')
  }, [node])

  if (target === null || kind === null) return null

  const levelLabel = t(LEVEL_LABEL[kind])
  const title = fill(t(target.mode === 'edit' ? 'admin.editTitle' : 'admin.createTitle'), {
    level: levelLabel,
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (target === null || kind === null) return

    const data = new FormData(event.currentTarget)
    const id = node?.id
    const parentId = target.mode === 'create' ? target.parentId : node?.parentId

    setError(null)
    setFieldErrors({})

    startTransition(async () => {
      const result = await submitByKind(kind, data, id, parentId)

      if (!result.ok) {
        setError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }
      onSaved(t('admin.saved'))
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('admin.curriculumSubtitle')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={error} />

          {kind === 'exam' ? (
            <ExamFields node={node?.kind === 'exam' ? node : null} errors={fieldErrors} />
          ) : null}
          {kind === 'subject' ? (
            <SubjectFields node={node?.kind === 'subject' ? node : null} errors={fieldErrors} />
          ) : null}
          {kind === 'unit' ? (
            <UnitFields node={node?.kind === 'unit' ? node : null} errors={fieldErrors} />
          ) : null}
          {kind === 'topic' ? (
            <TopicFields
              node={node?.kind === 'topic' ? node : null}
              errors={fieldErrors}
              memoryNote={memoryNote}
              onMemoryNoteChange={setMemoryNote}
            />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('admin.cancel')}
            </Button>
            <SubmitButton pending={pending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────────────── Düzey alanları ─────────────────────────────── */

function ExamFields({
  node,
  errors,
}: {
  node: Extract<AnyNode, { kind: 'exam' }> | null
  errors: FieldErrors
}) {
  return (
    <>
      <Field
        id="code"
        label={t('admin.fieldCode')}
        hint={t('admin.fieldCodeHint')}
        error={errors.code}
      >
        {(aria) => (
          <Input
            {...aria}
            name="code"
            required
            defaultValue={node?.code ?? ''}
            spellCheck={false}
          />
        )}
      </Field>
      <Field id="name" label={t('admin.fieldName')} error={errors.name}>
        {(aria) => <Input {...aria} name="name" required defaultValue={node?.name ?? ''} />}
      </Field>
      <Field id="description" label={t('admin.fieldDescription')} error={errors.description}>
        {(aria) => (
          <Textarea {...aria} name="description" rows={2} defaultValue={node?.description ?? ''} />
        )}
      </Field>
      <Field
        id="wrongPenaltyDivisor"
        label={t('admin.fieldPenalty')}
        hint={t('admin.fieldPenaltyHint')}
        error={errors.wrongPenaltyDivisor}
      >
        {(aria) => (
          <Input
            {...aria}
            name="wrongPenaltyDivisor"
            type="number"
            min={3}
            max={4}
            step={1}
            required
            defaultValue={node?.wrongPenaltyDivisor ?? 4}
          />
        )}
      </Field>
      <div className="flex items-center gap-3">
        <Switch id="isActive" name="isActive" defaultChecked={node?.isActive ?? true} />
        <label htmlFor="isActive" className="text-sm font-medium">
          {t('admin.fieldActive')}
        </label>
      </div>
    </>
  )
}

function SubjectFields({
  node,
  errors,
}: {
  node: Extract<AnyNode, { kind: 'subject' }> | null
  errors: FieldErrors
}) {
  return (
    <>
      <Field id="name" label={t('admin.fieldName')} error={errors.name}>
        {(aria) => <Input {...aria} name="name" required defaultValue={node?.name ?? ''} />}
      </Field>
      <SlugField defaultValue={node?.slug ?? ''} error={errors.slug} />
      <Field
        id="color"
        label={t('admin.fieldColor')}
        hint={t('admin.fieldColorHint')}
        error={errors.color}
      >
        {(aria) => (
          <Input {...aria} name="color" defaultValue={node?.color ?? ''} spellCheck={false} />
        )}
      </Field>
      <Field id="questionCount" label={t('admin.fieldQuestionCount')} error={errors.questionCount}>
        {(aria) => (
          <Input
            {...aria}
            name="questionCount"
            type="number"
            min={0}
            max={500}
            step={1}
            defaultValue={node?.questionCount ?? ''}
          />
        )}
      </Field>
    </>
  )
}

function UnitFields({
  node,
  errors,
}: {
  node: Extract<AnyNode, { kind: 'unit' }> | null
  errors: FieldErrors
}) {
  return (
    <>
      <Field id="name" label={t('admin.fieldName')} error={errors.name}>
        {(aria) => <Input {...aria} name="name" required defaultValue={node?.name ?? ''} />}
      </Field>
      <SlugField defaultValue={node?.slug ?? ''} error={errors.slug} />
    </>
  )
}

function TopicFields({
  node,
  errors,
  memoryNote,
  onMemoryNoteChange,
}: {
  node: Extract<AnyNode, { kind: 'topic' }> | null
  errors: FieldErrors
  memoryNote: string
  onMemoryNoteChange: (value: string) => void
}) {
  return (
    <>
      <Field id="title" label={t('admin.fieldTitle')} error={errors.title}>
        {(aria) => <Input {...aria} name="title" required defaultValue={node?.title ?? ''} />}
      </Field>
      <SlugField defaultValue={node?.slug ?? ''} error={errors.slug} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="estimatedMinutes"
          label={t('admin.fieldMinutes')}
          error={errors.estimatedMinutes}
        >
          {(aria) => (
            <Input
              {...aria}
              name="estimatedMinutes"
              type="number"
              min={1}
              max={600}
              step={1}
              required
              defaultValue={node?.estimatedMinutes ?? 30}
            />
          )}
        </Field>
        <Field id="difficulty" label={t('admin.fieldDifficulty')} error={errors.difficulty}>
          {(aria) => (
            <Input
              {...aria}
              name="difficulty"
              type="number"
              min={1}
              max={5}
              step={1}
              required
              defaultValue={node?.difficulty ?? 3}
            />
          )}
        </Field>
        <Field
          id="examWeight"
          label={t('admin.fieldWeight')}
          hint={t('admin.fieldWeightHint')}
          error={errors.examWeight}
        >
          {(aria) => (
            <Input
              {...aria}
              name="examWeight"
              type="number"
              min={0}
              max={1}
              step={0.01}
              required
              defaultValue={node?.examWeight ?? 0.5}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          id="memoryNote"
          label={t('admin.fieldMemoryNote')}
          hint={t('admin.fieldMemoryNoteHint')}
          error={errors.memoryNote}
        >
          {(aria) => (
            <Textarea
              {...aria}
              name="memoryNote"
              rows={12}
              value={memoryNote}
              onChange={(event) => onMemoryNoteChange(event.target.value)}
              className="font-mono text-xs"
            />
          )}
        </Field>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t('admin.preview')}</p>
          <div className="border-border bg-muted/30 h-full max-h-80 overflow-y-auto rounded-md border p-3">
            {memoryNote.trim().length === 0 ? (
              <p className="text-muted-foreground text-xs">{t('admin.previewEmpty')}</p>
            ) : (
              <MarkdownPreview content={memoryNote} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function SlugField({
  defaultValue,
  error,
}: {
  defaultValue: string
  error?: string[] | undefined
}) {
  return (
    <Field id="slug" label={t('admin.fieldSlug')} hint={t('admin.fieldSlugHint')} error={error}>
      {(aria) => (
        <Input
          {...aria}
          name="slug"
          required
          defaultValue={defaultValue}
          spellCheck={false}
          autoCapitalize="none"
        />
      )}
    </Field>
  )
}

/* ────────────────────────────── Gönderim ────────────────────────────────── */

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? '').trim()
}

/**
 * Boş sayı alanı `undefined` gönderilir — boş dizge `z.coerce.number()`
 * tarafından 0'a çevrilirdi ve "girilmedi" ile "sıfır" ayrımı kaybolurdu.
 */
function optionalNumber(data: FormData, key: string): string | undefined {
  const value = text(data, key)
  return value === '' ? undefined : value
}

async function submitByKind(
  kind: AnyNode['kind'],
  data: FormData,
  id: string | undefined,
  parentId: string | null | undefined,
) {
  if (kind === 'exam') {
    return saveExam({
      ...(id ? { id } : {}),
      code: text(data, 'code'),
      name: text(data, 'name'),
      description: text(data, 'description'),
      wrongPenaltyDivisor: text(data, 'wrongPenaltyDivisor'),
      isActive: data.get('isActive') !== null,
    })
  }
  if (kind === 'subject') {
    return saveSubject({
      ...(id ? { id } : {}),
      examId: parentId ?? '',
      name: text(data, 'name'),
      slug: text(data, 'slug'),
      color: text(data, 'color'),
      ...(optionalNumber(data, 'questionCount') === undefined
        ? {}
        : { questionCount: optionalNumber(data, 'questionCount') }),
    })
  }
  if (kind === 'unit') {
    return saveUnit({
      ...(id ? { id } : {}),
      subjectId: parentId ?? '',
      name: text(data, 'name'),
      slug: text(data, 'slug'),
    })
  }
  return saveTopic({
    ...(id ? { id } : {}),
    unitId: parentId ?? '',
    title: text(data, 'title'),
    slug: text(data, 'slug'),
    estimatedMinutes: text(data, 'estimatedMinutes'),
    difficulty: text(data, 'difficulty'),
    examWeight: text(data, 'examWeight'),
    memoryNote: text(data, 'memoryNote'),
  })
}
