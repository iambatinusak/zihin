'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

import { Badge } from '@zihin/ui/badge'
import { Button } from '@zihin/ui/button'
import { Card, CardContent } from '@zihin/ui/card'
import { Input } from '@zihin/ui/input'
import { Field, FormErrorSummary, type FieldErrors } from '@/components/common/form-parts'
import { EmptyState } from '@/components/common/empty-state'
import { fill, t } from '@/lib/i18n/admin-media'
import {
  formatTimestamp,
  parseTimestamp,
  timelinePercent,
  validateCheckpointTimestamp,
} from '@/lib/media/checkpoint'
import { addCheckpoint, removeCheckpoint } from '@/app/(admin)/admin/videolar/actions'
import { QuestionPicker } from './question-picker'
import type { AdminCheckpoint, QuestionOption } from '@/lib/data/admin-media'

/**
 * Zaman çubuğu düzenleyicisi (spec §M15, "zaman çubuğunda işaretleme").
 *
 * GERÇEK BİR OYNATICI YOK, BİLİNÇLİ OLARAK. Editörün ihtiyacı saniyeyi tam
 * isabetle koymak; kaydırılabilir bir oynatıcı bunu fare hassasiyetine bırakır
 * ve 1-2 saniyelik kaymalar üretir. Sayısal zaman girdisi + görsel şerit hem
 * daha doğru hem klavyeyle kullanılabilir. Şerit durakların dağılımını
 * gösterir; girdinin kendisi doğruluğu sağlar.
 */

type CheckpointEditorProps = {
  videoId: string
  durationSeconds: number
  topicId: string
  checkpoints: AdminCheckpoint[]
}

export function CheckpointEditor({
  videoId,
  durationSeconds,
  topicId,
  checkpoints,
}: CheckpointEditorProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [timeText, setTimeText] = React.useState('')
  const [question, setQuestion] = React.useState<QuestionOption | null>(null)

  const topicIds = React.useMemo(() => [topicId], [topicId])
  const existing = checkpoints.map((checkpoint) => checkpoint.timestampSeconds)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})

    const seconds = parseTimestamp(timeText)
    if (seconds === null) {
      setFieldErrors({ timestampSeconds: ['Zamanı 90 ya da 1:30 biçiminde yazın.'] })
      return
    }
    if (!question) {
      setFieldErrors({ questionId: ['Bir soru seçmelisiniz.'] })
      return
    }

    // Aynı denetim sunucuda da yapılır; buradaki yalnızca gidiş-dönüşü
    // beklemeden hatayı göstermek içindir.
    const issue = validateCheckpointTimestamp({
      timestampSeconds: seconds,
      durationSeconds,
      existingTimestamps: existing,
    })
    if (issue) {
      setFieldErrors({ [issue.field]: [issue.message] })
      return
    }

    startTransition(async () => {
      const result = await addCheckpoint({
        videoId,
        questionId: question.id,
        timestampSeconds: seconds,
      })
      if (!result.ok) {
        setError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }
      setTimeText('')
      setQuestion(null)
      router.refresh()
    })
  }

  function remove(id: string) {
    setError(null)
    startTransition(async () => {
      const result = await removeCheckpoint({ id })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4" aria-busy={pending}>
      <Timeline checkpoints={checkpoints} durationSeconds={durationSeconds} />

      <Card>
        <CardContent className="space-y-4 py-6">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormErrorSummary message={error} />

            <Field
              id="timestampSeconds"
              label={t('adminMedia.checkpointTime')}
              hint={t('adminMedia.checkpointTimeHint')}
              error={fieldErrors.timestampSeconds}
              className="max-w-xs"
            >
              {(aria) => (
                <Input
                  {...aria}
                  value={timeText}
                  inputMode="numeric"
                  placeholder="1:30"
                  onChange={(event) => setTimeText(event.target.value)}
                />
              )}
            </Field>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('adminMedia.checkpointQuestion')}</p>
              {question ? (
                <div className="border-border flex items-start gap-3 rounded-md border p-3">
                  <p className="text-foreground line-clamp-2 flex-1 text-sm">{question.stem}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setQuestion(null)}>
                    {t('adminMedia.cancel')}
                  </Button>
                </div>
              ) : (
                <QuestionPicker
                  topicIds={topicIds}
                  selectedIds={[]}
                  onSelect={(selected) => setQuestion(selected)}
                />
              )}
              {fieldErrors.questionId?.[0] ? (
                <p role="alert" className="text-destructive text-xs font-medium">
                  {fieldErrors.questionId[0]}
                </p>
              ) : null}
            </div>

            <Button type="submit" disabled={pending}>
              {t('adminMedia.checkpointAdd')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {checkpoints.length === 0 ? (
        <EmptyState
          title={t('adminMedia.checkpointsEmptyTitle')}
          description={t('adminMedia.checkpointsEmptyBody')}
        />
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {checkpoints.map((checkpoint) => (
            <li key={checkpoint.id} className="flex items-start gap-3 p-3">
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {formatTimestamp(checkpoint.timestampSeconds)}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-foreground line-clamp-2 text-sm">{checkpoint.questionStem}</p>
                {checkpoint.questionIsPublished ? null : (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t('adminMedia.checkpointQuestionMissing')}
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => remove(checkpoint.id)}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                <span className="sr-only">{t('adminMedia.checkpointRemove')}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Görsel şerit. Renk tek başına anlam taşımaz: her işaretin erişilebilir adı
 * saniyesini söyler, altındaki liste zaten metinle tekrar eder.
 */
function Timeline({
  checkpoints,
  durationSeconds,
}: {
  checkpoints: AdminCheckpoint[]
  durationSeconds: number
}) {
  if (durationSeconds <= 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('adminMedia.checkpointTimelineNoDuration')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">{t('adminMedia.checkpointTimeline')}</p>
      <div className="bg-muted relative h-8 w-full rounded-md">
        {checkpoints.map((checkpoint) => (
          <span
            key={checkpoint.id}
            title={fill(t('adminMedia.checkpointAt'), {
              time: formatTimestamp(checkpoint.timestampSeconds),
            })}
            className="bg-primary absolute top-1 h-6 w-1 rounded-full"
            style={{
              left: `calc(${timelinePercent(checkpoint.timestampSeconds, durationSeconds)}% - 2px)`,
            }}
          >
            <span className="sr-only">
              {fill(t('adminMedia.checkpointAt'), {
                time: formatTimestamp(checkpoint.timestampSeconds),
              })}
            </span>
          </span>
        ))}
      </div>
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>0:00</span>
        <span>{formatTimestamp(durationSeconds)}</span>
      </div>
    </div>
  )
}
