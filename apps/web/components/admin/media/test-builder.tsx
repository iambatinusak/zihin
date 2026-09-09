'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

import { Button } from '@zihin/ui/button'
import { Card, CardContent } from '@zihin/ui/card'
import { Input } from '@zihin/ui/input'
import { Label } from '@zihin/ui/label'
import { Switch } from '@zihin/ui/switch'
import {
  Field,
  FormErrorSummary,
  SubmitButton,
  SwitchRow,
  type FieldErrors,
} from '@/components/common/form-parts'
import { fill, t } from '@/lib/i18n/admin-media'
import { createTest } from '@/app/(admin)/admin/testler/actions'
import { QuestionPicker } from './question-picker'
import type { QuestionOption } from '@/lib/data/admin-media'

/**
 * Konu/ünite testi kurucusu (spec §M15).
 *
 * İki yol: soruları tek tek seçmek ya da "bu konudan rastgele N soru".
 * Rastgele kural sunucuda, TESTİN OLUŞTURULMA ANINDA çözülür ve sabitlenir —
 * içeriği çözüm anında değişen bir test iki öğrencinin sonucunu
 * kıyaslanamaz kılardı.
 */

type TestBuilderProps = {
  topicId: string
  /** Konudaki yayımlanmış soru sayısı; rastgele kuralın üst sınırı. */
  poolSize: number
}

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px]'

export function TestBuilder({ topicId, poolSize }: TestBuilderProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})

  const [mode, setMode] = React.useState<'manual' | 'random'>('manual')
  const [selected, setSelected] = React.useState<QuestionOption[]>([])
  const [isPublished, setIsPublished] = React.useState(false)

  const topicIds = React.useMemo(() => [topicId], [topicId])

  // Konu değişirse önceki seçim başka bir konunun sorularını taşır.
  React.useEffect(() => {
    setSelected([])
  }, [topicId])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    setError(null)
    setFieldErrors({})

    const randomRaw = String(data.get('randomCount') ?? '').trim()

    startTransition(async () => {
      const result = await createTest({
        title: String(data.get('title') ?? ''),
        type: String(data.get('type') ?? 'topic_test'),
        topicId,
        durationMinutes: String(data.get('durationMinutes') ?? ''),
        isPublished,
        mode,
        questionIds: mode === 'manual' ? selected.map((question) => question.id) : [],
        ...(mode === 'random' && randomRaw !== '' ? { randomCount: randomRaw } : {}),
      })

      if (!result.ok) {
        setError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }

      router.push(`/admin/testler/${result.data.id}`)
    })
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormErrorSummary message={error} />

          <Field id="title" label={t('adminMedia.testTitleField')} error={fieldErrors.title}>
            {(aria) => <Input {...aria} name="title" required />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="type" label={t('adminMedia.testType')} error={fieldErrors.type}>
              {(aria) => (
                <select {...aria} name="type" className={SELECT_CLASS} defaultValue="topic_test">
                  <option value="topic_test">{t('adminMedia.testTypeTopic')}</option>
                  <option value="unit_test">{t('adminMedia.testTypeUnit')}</option>
                </select>
              )}
            </Field>

            <Field
              id="durationMinutes"
              label={t('adminMedia.testDuration')}
              hint={t('adminMedia.testDurationHint')}
              error={fieldErrors.durationMinutes}
            >
              {(aria) => <Input {...aria} name="durationMinutes" type="number" min={1} max={600} />}
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('adminMedia.testSelectionMode')}</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  value="manual"
                  checked={mode === 'manual'}
                  onChange={() => setMode('manual')}
                />
                {t('adminMedia.testModeManual')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  value="random"
                  checked={mode === 'random'}
                  onChange={() => setMode('random')}
                />
                {t('adminMedia.testModeRandom')}
              </label>
            </div>
          </fieldset>

          {poolSize === 0 ? (
            <p className="text-muted-foreground text-sm">{t('adminMedia.testEmptyPool')}</p>
          ) : null}

          {mode === 'random' ? (
            <Field
              id="randomCount"
              label={t('adminMedia.testRandomCount')}
              hint={t('adminMedia.testRandomHint')}
              error={fieldErrors.randomCount}
              className="max-w-xs"
            >
              {(aria) => (
                <>
                  <Input {...aria} name="randomCount" type="number" min={1} max={200} />
                  {poolSize > 0 ? (
                    <p className="text-muted-foreground text-xs">
                      {fill(t('adminMedia.testShortPool'), { count: poolSize })}
                    </p>
                  ) : null}
                </>
              )}
            </Field>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t('adminMedia.testQuestions')}</Label>
                <p className="text-muted-foreground text-xs">
                  {fill(t('adminMedia.testSelected'), { count: selected.length })}
                </p>
              </div>

              {selected.length > 0 ? (
                <ul className="divide-border border-border divide-y rounded-md border">
                  {selected.map((question, index) => (
                    <li key={question.id} className="flex items-start gap-3 p-3">
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {index + 1}.
                      </span>
                      <p className="text-foreground line-clamp-2 flex-1 text-sm">{question.stem}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setSelected((current) =>
                            current.filter((item) => item.id !== question.id),
                          )
                        }
                      >
                        <X aria-hidden="true" className="size-4" />
                        <span className="sr-only">{t('adminMedia.testRemoveQuestion')}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <QuestionPicker
                topicIds={topicIds}
                selectedIds={selected.map((question) => question.id)}
                multiple
                label={t('adminMedia.checkpointSearch')}
                onSelect={(question) =>
                  setSelected((current) =>
                    current.some((item) => item.id === question.id)
                      ? current
                      : [...current, question],
                  )
                }
              />

              {fieldErrors.questionIds?.[0] ? (
                <p role="alert" className="text-destructive text-xs font-medium">
                  {fieldErrors.questionIds[0]}
                </p>
              ) : null}
            </div>
          )}

          <SwitchRow id="isPublished" label={t('adminMedia.published')}>
            {(aria) => <Switch {...aria} checked={isPublished} onCheckedChange={setIsPublished} />}
          </SwitchRow>

          <SubmitButton
            pending={pending}
            label={t('adminMedia.create')}
            pendingLabel={t('adminMedia.creating')}
          />
        </form>
      </CardContent>
    </Card>
  )
}
