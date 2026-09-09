'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

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
import { allocateMockSections } from '@/lib/media/allocation'
import { createMockExam } from '@/app/(admin)/admin/denemeler/actions'
import type { SubjectPool } from '@/lib/data/admin-media'

/**
 * Deneme kurucusu (spec §M15).
 *
 * Ders başına istenen sayı yazılırken havuzun ne kadar dolu olduğu ANINDA
 * gösterilir. Kısa havuz bu projede normal durumdur (1164 konudan üçünde soru
 * var); bu yüzden kısalık bir hata gibi değil, bilgilendirici bir uyarı olarak
 * sunulur ve form yine gönderilebilir. Hesap `lib/media/allocation.ts` içinde,
 * sunucuyla aynı saf fonksiyonla yapılır.
 */

type MockBuilderProps = {
  examId: string
  pools: SubjectPool[]
}

/** `datetime-local` değerini saat dilimi damgalı ISO'ya çevirir. */
function toIso(value: string): string {
  if (value.trim() === '') return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function MockBuilder({ examId, pools }: MockBuilderProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [isPublished, setIsPublished] = React.useState(false)
  const [counts, setCounts] = React.useState<Record<string, string>>({})

  // Sınav değişince önceki ders sayıları başka bir sınavın derslerine aitti.
  React.useEffect(() => {
    setCounts({})
  }, [examId])

  const requests = pools.map((pool) => ({
    subjectId: pool.subjectId,
    subjectName: pool.subjectName,
    requested: Number(counts[pool.subjectId] ?? '0') || 0,
  }))

  const availability: Record<string, number> = {}
  for (const pool of pools) availability[pool.subjectId] = pool.questionIds.length

  const allocation = allocateMockSections(requests, availability)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    setError(null)
    setFieldErrors({})

    startTransition(async () => {
      const result = await createMockExam({
        examId,
        title: String(data.get('title') ?? ''),
        durationMinutes: String(data.get('durationMinutes') ?? ''),
        publishAt: toIso(String(data.get('publishAt') ?? '')),
        liveWindowStart: toIso(String(data.get('liveWindowStart') ?? '')),
        liveWindowEnd: toIso(String(data.get('liveWindowEnd') ?? '')),
        isPublished,
        sections: pools.map((pool) => ({
          subjectId: pool.subjectId,
          count: counts[pool.subjectId] ?? '0',
        })),
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

          <Field id="title" label={t('adminMedia.mockTitleField')} error={fieldErrors.title}>
            {(aria) => <Input {...aria} name="title" required />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="durationMinutes"
              label={t('adminMedia.mockDuration')}
              error={fieldErrors.durationMinutes}
            >
              {(aria) => <Input {...aria} name="durationMinutes" type="number" min={1} max={600} />}
            </Field>

            <Field
              id="publishAt"
              label={t('adminMedia.mockPublishAt')}
              hint={t('adminMedia.mockPublishAtHint')}
              error={fieldErrors.publishAt}
            >
              {(aria) => <Input {...aria} name="publishAt" type="datetime-local" />}
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('adminMedia.mockLiveWindow')}</legend>
            <p className="text-muted-foreground text-xs">{t('adminMedia.mockLiveWindowHint')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="liveWindowStart"
                label={t('adminMedia.mockLiveStart')}
                error={fieldErrors.liveWindowStart}
              >
                {(aria) => <Input {...aria} name="liveWindowStart" type="datetime-local" />}
              </Field>
              <Field
                id="liveWindowEnd"
                label={t('adminMedia.mockLiveEnd')}
                error={fieldErrors.liveWindowEnd}
              >
                {(aria) => <Input {...aria} name="liveWindowEnd" type="datetime-local" />}
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('adminMedia.mockSectionCounts')}</legend>
            <p className="text-muted-foreground text-xs">{t('adminMedia.mockSectionsNote')}</p>

            <ul className="divide-border border-border divide-y rounded-md border">
              {pools.map((pool) => (
                <li key={pool.subjectId} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`ders-${pool.subjectId}`} className="text-sm">
                      {pool.subjectName}
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      {fill(t('adminMedia.mockAvailable'), { count: pool.questionIds.length })}
                    </p>
                  </div>
                  <Input
                    id={`ders-${pool.subjectId}`}
                    type="number"
                    min={0}
                    max={200}
                    className="w-24"
                    value={counts[pool.subjectId] ?? ''}
                    onChange={(event) =>
                      setCounts((current) => ({
                        ...current,
                        [pool.subjectId]: event.target.value,
                      }))
                    }
                  />
                </li>
              ))}
            </ul>

            {fieldErrors.sections?.[0] ? (
              <p role="alert" className="text-destructive text-xs font-medium">
                {fieldErrors.sections[0]}
              </p>
            ) : null}
          </fieldset>

          {allocation.totalRequested > 0 ? (
            <div className="border-border bg-muted/40 space-y-2 rounded-lg border px-4 py-3 text-sm">
              <p className="font-medium">
                {fill(t('adminMedia.mockTotals'), {
                  taken: allocation.totalTaken,
                  requested: allocation.totalRequested,
                })}
              </p>
              {allocation.isEmpty ? (
                <p className="text-destructive flex items-start gap-2">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {t('adminMedia.mockPoolEmptyAll')}
                </p>
              ) : null}
              {allocation.sections
                .filter((section) => section.shortfall > 0)
                .map((section) => (
                  <p
                    key={section.subjectId}
                    className="text-muted-foreground flex items-start gap-2"
                  >
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {fill(t('adminMedia.mockPoolShort'), {
                      name: section.subjectName,
                      requested: section.requested,
                      available: section.available,
                      taken: section.taken,
                    })}
                  </p>
                ))}
            </div>
          ) : null}

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
