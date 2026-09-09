'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Input } from '@zihin/ui/input'
import { Switch } from '@zihin/ui/switch'
import { Textarea } from '@zihin/ui/textarea'
import { Field, FormErrorSummary, SubmitButton, SwitchRow } from '@/components/common/form-parts'
import { deleteQuestion, saveQuestion } from '@/app/(admin)/admin/sorular/actions'
import {
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  MIN_OPTIONS,
  OPTION_KEYS,
  type OptionKey,
} from '@/lib/admin/questions/options'
import {
  buildQuestionImageKey,
  isAllowedQuestionImageSize,
  isAllowedQuestionImageType,
  QUESTION_IMAGES_BUCKET,
} from '@/lib/admin/questions/storage'
import type { OutcomeOption, QuestionDetail, TopicOption } from '@/lib/data/admin-questions'
import { LiveRegion } from '@/components/common/live-region'
import { MarkdownPreview } from './markdown-preview'
import { newOption, OptionEditor, type EditableOption } from './option-editor'
import { SelectField } from './field-select'
import { questionStrings } from './strings'

/**
 * Soru düzenleyici (spec §M15).
 *
 * GÖRSEL AKIŞI `soru-sor` ile aynı: dosya doğrudan kovaya yüklenir ve action'a
 * yalnızca NESNE ANAHTARI gider; tür ve boyut sunucuda nesnenin kendi meta
 * verisinden yeniden doğrulanır. Buradaki denetimler erken geri bildirim
 * içindir, güvenlik sınırı değil.
 *
 * DOĞRU ŞIK `uid` ile tutulur, harfle değil: şıklar sıralanabildiği için harf
 * uçucu bir bilgidir. Gönderirken sıradaki konuma göre harfe çevrilir.
 */

type QuestionFormProps = {
  userId: string
  topics: TopicOption[]
  outcomes: OutcomeOption[]
  question: QuestionDetail | null
}

export function QuestionForm({ userId, topics, outcomes, question }: QuestionFormProps) {
  const s = questionStrings()
  const router = useRouter()

  const initial = React.useMemo(() => toInitialState(question), [question])

  const [topicId, setTopicId] = React.useState(initial.topicId)
  const [outcomeId, setOutcomeId] = React.useState(initial.outcomeId)
  const [stem, setStem] = React.useState(initial.stem)
  const [options, setOptions] = React.useState<EditableOption[]>(initial.options)
  const [correctUid, setCorrectUid] = React.useState<string | null>(initial.correctUid)
  const [explanation, setExplanation] = React.useState(initial.explanation)
  const [solutionVideoUrl, setSolutionVideoUrl] = React.useState(initial.solutionVideoUrl)
  const [difficulty, setDifficulty] = React.useState(String(initial.difficulty))
  const [expectedSeconds, setExpectedSeconds] = React.useState(initial.expectedSeconds)
  const [tags, setTags] = React.useState(initial.tags)
  const [isPublished, setIsPublished] = React.useState(initial.isPublished)

  const [imageUrl, setImageUrl] = React.useState(question?.imageUrl ?? null)
  /** undefined → dokunma, null → kaldır, string → yeni anahtar. */
  const [imageKey, setImageKey] = React.useState<string | null | undefined>(undefined)
  const [uploading, setUploading] = React.useState(false)

  const [pending, setPending] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[] | undefined>>({})

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  // Kazanımlar sunucudan YALNIZCA kaydın mevcut konusu için gelir. Editör
  // konuyu değiştirdiğinde kutu boşalır ve kilitlenir: yeni konunun kazanımını
  // yanlışlıkla eskisinin listesinden seçmek, sessiz bir veri hatası olurdu.
  // Kayıttan sonra sayfa yenilenir ve yeni konunun kazanımları gelir.
  const outcomesForTopic = topicId === question?.topicId ? outcomes : []

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    if (!selected) return

    if (!isAllowedQuestionImageType(selected.type)) {
      toast.error(s.imageWrongType)
      resetFileInput()
      return
    }
    if (!isAllowedQuestionImageSize(selected.size)) {
      toast.error(s.imageTooLarge)
      resetFileInput()
      return
    }

    setUploading(true)
    try {
      const unique = crypto.randomUUID().replace(/-/g, '')
      const key = buildQuestionImageKey(userId, { unique, type: selected.type })

      // Görsel yükleme isteğe bağlı; tarayıcı istemcisi (~189 kB) o ana kadar
      // indirilmez.
      const { getBrowserClient } = await import('@/lib/supabase/client')
      const client = getBrowserClient()
      const { error } = await client.storage
        .from(QUESTION_IMAGES_BUCKET)
        .upload(key, selected, { contentType: selected.type, upsert: false })

      if (error) throw new Error(error.message)

      setImageKey(key)
      setImageUrl(client.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(key).data.publicUrl)
    } catch {
      toast.error(s.imageUploadFailed)
    } finally {
      setUploading(false)
      resetFileInput()
    }
  }

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage() {
    setImageKey(null)
    setImageUrl(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || uploading) return

    setFormError(null)
    setFieldErrors({})

    const filled = options.filter((option) => option.text.trim() !== '')
    if (filled.length < MIN_OPTIONS) {
      setFieldErrors({ options: [`Soru en az ${MIN_OPTIONS} şık içermeli.`] })
      return
    }

    const correctIndex = filled.findIndex((option) => option.uid === correctUid)
    if (correctIndex < 0) {
      setFieldErrors({ correctOption: ['Doğru şıkkı seçin.'] })
      return
    }

    const correctKey = OPTION_KEYS[correctIndex]
    if (!correctKey) {
      setFieldErrors({ correctOption: ['Doğru şıkkı seçin.'] })
      return
    }

    setPending(true)
    const result = await saveQuestion({
      id: question?.id ?? null,
      topicId,
      outcomeId: outcomeId === '' ? null : outcomeId,
      stem,
      options: filled.map((option, index) => ({
        key: OPTION_KEYS[index] as OptionKey,
        text: option.text.trim(),
      })),
      correctOption: correctKey,
      explanation: explanation.trim(),
      solutionVideoUrl: solutionVideoUrl.trim(),
      difficulty: Number(difficulty),
      expectedSeconds: expectedSeconds.trim() === '' ? null : Number(expectedSeconds),
      tags: splitTags(tags),
      isPublished,
      ...(imageKey === undefined ? {} : { imageKey }),
    })
    setPending(false)

    if (!result.ok) {
      setFormError(result.error.message)
      setFieldErrors(result.error.fieldErrors ?? {})
      return
    }

    toast.success(s.saved)
    setImageKey(undefined)
    if (result.data.created) {
      router.replace(`/admin/sorular/${result.data.id}`)
    } else {
      router.refresh()
    }
  }

  async function handleDelete() {
    if (!question || deleting) return
    if (!window.confirm(s.deleteConfirm)) return

    setDeleting(true)
    const result = await deleteQuestion({ id: question.id })
    setDeleting(false)

    if (!result.ok) {
      toast.error(result.error.message)
      return
    }

    toast.success(s.deleted)
    router.push('/admin/sorular')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <FormErrorSummary message={formError} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field id="soru-konu" label={s.topicFieldLabel} error={fieldErrors.topicId}>
            {(aria) => (
              <SelectField
                {...aria}
                value={topicId}
                onChange={(event) => {
                  setTopicId(event.target.value)
                  setOutcomeId('')
                }}
              >
                <option value="">{s.topicPlaceholder}</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {`${topic.subjectName} · ${topic.unitName} · ${topic.title}`}
                  </option>
                ))}
              </SelectField>
            )}
          </Field>

          <Field id="soru-kok" label={s.stemLabel} hint={s.stemHint} error={fieldErrors.stem}>
            {(aria) => (
              <Textarea
                {...aria}
                rows={8}
                value={stem}
                onChange={(event) => setStem(event.target.value)}
                className="font-mono text-sm"
              />
            )}
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{s.previewTitle}</p>
          <MarkdownPreview content={stem} />
        </div>
      </div>

      <OptionEditor
        options={options}
        onChange={setOptions}
        correctUid={correctUid}
        onCorrectChange={setCorrectUid}
        error={fieldErrors.options}
        correctError={fieldErrors.correctOption}
        disabled={pending}
      />

      <Field
        id="soru-aciklama"
        label={s.explanationLabel}
        hint={s.explanationHint}
        error={fieldErrors.explanation}
      >
        {(aria) => (
          <Textarea
            {...aria}
            rows={5}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            className="font-mono text-sm"
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="soru-zorluk" label={s.difficultyFieldLabel} error={fieldErrors.difficulty}>
          {(aria) => (
            <SelectField
              {...aria}
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              {difficultyValues().map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField>
          )}
        </Field>

        <Field
          id="soru-sure"
          label={s.expectedSecondsLabel}
          hint={s.expectedSecondsHint}
          error={fieldErrors.expectedSeconds}
        >
          {(aria) => (
            <Input
              {...aria}
              type="number"
              min={1}
              max={3600}
              value={expectedSeconds}
              onChange={(event) => setExpectedSeconds(event.target.value)}
            />
          )}
        </Field>

        <Field id="soru-kazanim" label={s.outcomeLabel} error={fieldErrors.outcomeId}>
          {(aria) => (
            <SelectField
              {...aria}
              value={outcomeId}
              disabled={outcomesForTopic.length === 0}
              onChange={(event) => setOutcomeId(event.target.value)}
            >
              <option value="">{s.outcomeNone}</option>
              {outcomesForTopic.map((outcome) => (
                <option key={outcome.id} value={outcome.id}>
                  {`${outcome.code} — ${outcome.description}`}
                </option>
              ))}
            </SelectField>
          )}
        </Field>

        <Field id="soru-etiket" label={s.tagsLabel} hint={s.tagsHint} error={fieldErrors.tags}>
          {(aria) => (
            <Input {...aria} value={tags} onChange={(event) => setTags(event.target.value)} />
          )}
        </Field>
      </div>

      <Field id="soru-video" label={s.solutionVideoLabel} error={fieldErrors.solutionVideoUrl}>
        {(aria) => (
          <Input
            {...aria}
            type="url"
            inputMode="url"
            value={solutionVideoUrl}
            onChange={(event) => setSolutionVideoUrl(event.target.value)}
          />
        )}
      </Field>

      <div className="space-y-2">
        <Field
          id="soru-gorsel"
          label={s.imageLabel}
          hint={s.imageHint}
          error={fieldErrors.imageKey}
        >
          {(aria) => (
            <Input
              {...aria}
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploading || pending}
              onChange={handleFileChange}
            />
          )}
        </Field>

        <LiveRegion message={uploading ? s.imageUploading : ''} />
        {uploading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {s.imageUploading}
          </p>
        ) : null}

        {imageUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={s.imagePreview}
              className="border-border max-h-64 rounded-md border"
            />
            <Button type="button" variant="outline" size="sm" onClick={removeImage}>
              {s.imageRemove}
            </Button>
          </div>
        ) : null}
      </div>

      <SwitchRow id="soru-yayin" label={s.publishLabel} hint={s.publishHint}>
        {(aria) => <Switch {...aria} checked={isPublished} onCheckedChange={setIsPublished} />}
      </SwitchRow>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pending={pending}
          label={s.save}
          pendingLabel={s.saving}
          className="min-w-40"
        />
        <Button type="button" variant="ghost" asChild>
          <Link href="/admin/sorular">{s.backToList}</Link>
        </Button>

        {question ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive ml-auto"
            disabled={deleting}
            onClick={handleDelete}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {s.deleteQuestion}
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function toInitialState(question: QuestionDetail | null) {
  const options: EditableOption[] =
    question && question.options.length > 0
      ? question.options.map((option) => ({ uid: crypto.randomUUID(), text: option.text }))
      : [newOption(), newOption(), newOption(), newOption()]

  const correctIndex =
    question && question.correctOption
      ? question.options.findIndex((option) => option.key === question.correctOption)
      : -1

  return {
    topicId: question?.topicId ?? '',
    outcomeId: question?.outcomeId ?? '',
    stem: question?.stem ?? '',
    options,
    correctUid: correctIndex >= 0 ? (options[correctIndex]?.uid ?? null) : null,
    explanation: question?.explanation ?? '',
    solutionVideoUrl: question?.solutionVideoUrl ?? '',
    difficulty: question?.difficulty ?? 3,
    expectedSeconds: question?.expectedSeconds ? String(question.expectedSeconds) : '',
    tags: (question?.tags ?? []).join(', '),
    isPublished: question?.isPublished ?? false,
  }
}

function difficultyValues(): number[] {
  const values: number[] = []
  for (let value = MIN_DIFFICULTY; value <= MAX_DIFFICULTY; value += 1) values.push(value)
  return values
}

/** "cebir, denklem ,, türev" → ["cebir","denklem","türev"] */
export function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
    .slice(0, 20)
}
