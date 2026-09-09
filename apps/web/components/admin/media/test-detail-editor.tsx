'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, X } from 'lucide-react'

import { Badge } from '@zihin/ui/badge'
import { Button } from '@zihin/ui/button'
import { Card, CardContent } from '@zihin/ui/card'
import { Input } from '@zihin/ui/input'
import { Switch } from '@zihin/ui/switch'
import {
  Field,
  FormErrorSummary,
  FormSuccess,
  SubmitButton,
  SwitchRow,
  type FieldErrors,
} from '@/components/common/form-parts'
import { EmptyState } from '@/components/common/empty-state'
import { t } from '@/lib/i18n/admin-media'
import {
  addTestQuestion,
  removeTestQuestion,
  reorderTestQuestions,
  updateTest,
} from '@/app/(admin)/admin/testler/actions'
import { QuestionPicker } from './question-picker'
import type { AdminTest, AdminTestQuestion } from '@/lib/data/admin-media'

/**
 * Test/deneme ayrıntısı: başlık, süre, yayın durumu ve soru sırası.
 *
 * Sıralama İSTEMCİDE tutulur, sunucuya TAM liste olarak tek seferde gönderilir
 * (`reorderTestQuestions`). Her ok tuşunda bir yazma yapmak, art arda taşımada
 * yarı yazılmış bir sıra bırakırdı.
 *
 * Denemede soru EKLEME sunulmaz: her deneme sorusunun `section` değeri ders
 * adıyla yazılır ve çözme ekranındaki sekmeler ona bakar; buradan bölümsüz bir
 * soru eklemek o gruplamayı bozardı. Denemenin soruları kurucuda belirlenir.
 */

type TestDetailEditorProps = {
  test: AdminTest
  questions: AdminTestQuestion[]
  /** Soru eklerken aranacak konular. Denemede boş geçilir. */
  topicIds: string[]
  /** Denemede false: bölümsüz soru eklemek sekmeleri bozar. */
  canAddQuestions: boolean
}

export function TestDetailEditor({
  test,
  questions,
  topicIds,
  canAddQuestions,
}: TestDetailEditorProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [success, setSuccess] = React.useState(false)
  const [isPublished, setIsPublished] = React.useState(test.is_published)

  const [order, setOrder] = React.useState<AdminTestQuestion[]>(questions)
  const [orderDirty, setOrderDirty] = React.useState(false)

  // Sunucudan yeni bir liste geldiğinde (soru çıkarıldı, sayfa tazelendi)
  // istemcideki sıra artık geçersizdir.
  React.useEffect(() => {
    setOrder(questions)
    setOrderDirty(false)
  }, [questions])

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= order.length) return
    const next = [...order]
    const a = next[index]
    const b = next[target]
    if (!a || !b) return
    next[index] = b
    next[target] = a
    setOrder(next)
    setOrderDirty(true)
  }

  function saveMeta(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    setError(null)
    setFieldErrors({})
    setSuccess(false)

    startTransition(async () => {
      const result = await updateTest({
        id: test.id,
        title: String(data.get('title') ?? ''),
        durationMinutes: String(data.get('durationMinutes') ?? ''),
        isPublished,
      })
      if (!result.ok) {
        setError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }
      setSuccess(true)
      router.refresh()
    })
  }

  function saveOrder() {
    setError(null)
    startTransition(async () => {
      const result = await reorderTestQuestions({
        testId: test.id,
        questionIds: order.map((question) => question.questionId),
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setOrderDirty(false)
      router.refresh()
    })
  }

  function add(questionId: string) {
    setError(null)
    startTransition(async () => {
      const result = await addTestQuestion({ testId: test.id, questionId })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.refresh()
    })
  }

  function remove(questionId: string) {
    setError(null)
    startTransition(async () => {
      const result = await removeTestQuestion({ testId: test.id, questionId })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.refresh()
    })
  }

  const durationMinutes =
    test.duration_seconds === null ? '' : String(Math.round(test.duration_seconds / 60))

  return (
    <div className="space-y-6" aria-busy={pending}>
      <Card>
        <CardContent className="py-6">
          <form onSubmit={saveMeta} className="space-y-4" noValidate>
            <FormErrorSummary message={error} />

            <Field id="title" label={t('adminMedia.testTitleField')} error={fieldErrors.title}>
              {(aria) => <Input {...aria} name="title" required defaultValue={test.title} />}
            </Field>

            <Field
              id="durationMinutes"
              label={t('adminMedia.testDuration')}
              hint={t('adminMedia.testDurationHint')}
              error={fieldErrors.durationMinutes}
              className="max-w-xs"
            >
              {(aria) => (
                <Input
                  {...aria}
                  name="durationMinutes"
                  type="number"
                  min={1}
                  max={600}
                  defaultValue={durationMinutes}
                />
              )}
            </Field>

            <SwitchRow id="isPublished" label={t('adminMedia.published')}>
              {(aria) => (
                <Switch {...aria} checked={isPublished} onCheckedChange={setIsPublished} />
              )}
            </SwitchRow>

            <div className="flex items-center gap-3">
              <SubmitButton pending={pending} label={t('adminMedia.save')} />
              <FormSuccess show={success} message={t('adminMedia.saved')} />
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-foreground text-lg font-semibold">{t('adminMedia.testQuestions')}</h2>
          {orderDirty ? (
            <Button type="button" size="sm" disabled={pending} onClick={saveOrder}>
              {t('adminMedia.testOrderSave')}
            </Button>
          ) : null}
        </div>

        {order.length === 0 ? (
          <EmptyState
            title={t('adminMedia.testsEmptyTitle')}
            description={t('adminMedia.testsEmptyBody')}
          />
        ) : (
          <ol className="divide-border border-border divide-y rounded-lg border">
            {order.map((question, index) => (
              <li key={question.questionId} className="flex items-start gap-3 p-3">
                <span className="text-muted-foreground w-6 shrink-0 text-xs tabular-nums">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground line-clamp-2 text-sm">{question.stem}</p>
                  {question.section ? (
                    <Badge variant="secondary" className="mt-1">
                      {question.section}
                    </Badge>
                  ) : null}
                  {question.isPublished ? null : (
                    <p className="text-muted-foreground mt-1 text-xs">{t('adminMedia.draft')}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                    <span className="sr-only">{t('adminMedia.testMoveUp')}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending || index === order.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                    <span className="sr-only">{t('adminMedia.testMoveDown')}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => remove(question.questionId)}
                  >
                    <X aria-hidden="true" className="size-4" />
                    <span className="sr-only">{t('adminMedia.testRemoveQuestion')}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {canAddQuestions && topicIds.length > 0 ? (
          <Card>
            <CardContent className="py-6">
              <QuestionPicker
                topicIds={topicIds}
                selectedIds={order.map((question) => question.questionId)}
                multiple
                onSelect={(question) => add(question.id)}
              />
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  )
}
