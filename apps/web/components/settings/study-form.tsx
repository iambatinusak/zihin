'use client'

import { useState, type FormEvent } from 'react'
import { Input } from '@zihin/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zihin/ui/select'
import { cn } from '@zihin/ui/lib/utils'
import { updateStudyPreferences } from '@/app/(student)/ayarlar/actions'
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES, STUDY_DAYS } from '@/app/(student)/ayarlar/schemas'
import { section, t } from '@/lib/i18n/settings'
import { Field, FormErrorSummary, FormSuccess, SubmitButton } from '@/components/common/form-parts'
import { useSettingsAction } from './use-settings-action'

export type ExamOption = { id: string; name: string }

type StudyFormProps = {
  exams: ExamOption[]
  examId: string
  targetExamDate: string
  dailyMinutes: number
  studyDays: number[]
}

const NO_EXAM = 'yok'

const s = section<{ study: Record<string, string>; days: Record<string, string> }>('settings')

export function StudyForm({ exams, ...initial }: StudyFormProps) {
  const [examId, setExamId] = useState(initial.examId || NO_EXAM)
  const [examDate, setExamDate] = useState(initial.targetExamDate)
  const [dailyMinutes, setDailyMinutes] = useState(String(initial.dailyMinutes))
  const [studyDays, setStudyDays] = useState<number[]>(initial.studyDays)

  const { submit, pending, error, success, fieldError } = useSettingsAction(updateStudyPreferences)

  function toggleDay(day: number) {
    setStudyDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    )
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit({
      examId: examId === NO_EXAM ? '' : examId,
      targetExamDate: examDate,
      dailyMinutes,
      studyDays,
    })
  }

  const daysError = fieldError('studyDays')

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormErrorSummary message={error} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="ayar-sinav" label={t('settings.study.exam')} error={fieldError('examId')}>
          {(props) => (
            <Select value={examId} onValueChange={setExamId}>
              <SelectTrigger {...props} className="w-full">
                <SelectValue placeholder={s.study.examPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EXAM}>{s.study.examNone}</SelectItem>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field
          id="ayar-sinav-tarihi"
          label={t('settings.study.examDate')}
          hint={s.study.examDateHint}
          error={fieldError('targetExamDate')}
        >
          {(props) => (
            <Input
              {...props}
              name="targetExamDate"
              type="date"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
            />
          )}
        </Field>

        <Field
          id="ayar-gunluk-sure"
          label={t('settings.study.dailyMinutes')}
          hint={s.study.dailyMinutesHint}
          error={fieldError('dailyMinutes')}
        >
          {(props) => (
            <Input
              {...props}
              name="dailyMinutes"
              type="number"
              inputMode="numeric"
              min={MIN_DAILY_MINUTES}
              max={MAX_DAILY_MINUTES}
              step={5}
              value={dailyMinutes}
              onChange={(event) => setDailyMinutes(event.target.value)}
            />
          )}
        </Field>
      </div>

      {/* Gün seçimi bir onay kutusu grubu; fieldset/legend etiketlemeyi taşır. */}
      <fieldset
        aria-describedby={daysError ? 'ayar-gunler-hata' : 'ayar-gunler-aciklama'}
        aria-invalid={Boolean(daysError)}
      >
        <legend className="text-sm font-medium">{s.study.studyDays}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {STUDY_DAYS.map((day) => {
            const checked = studyDays.includes(day)
            return (
              <label
                key={day}
                className={cn(
                  'border-input has-[:focus-visible]:ring-ring/50 cursor-pointer select-none rounded-md border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-[3px]',
                  checked
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <input
                  type="checkbox"
                  name="studyDays"
                  value={day}
                  checked={checked}
                  onChange={() => toggleDay(day)}
                  className="sr-only"
                />
                <span aria-hidden="true">{s.days[`short${day}`]}</span>
                <span className="sr-only">{s.days[String(day)]}</span>
              </label>
            )
          })}
        </div>
        <p id="ayar-gunler-aciklama" className="text-muted-foreground mt-2 text-xs">
          {s.study.studyDaysHint}
        </p>
        {daysError ? (
          <p id="ayar-gunler-hata" className="text-destructive mt-1 text-xs font-medium">
            {daysError}
          </p>
        ) : null}
      </fieldset>

      {/* Tercih anında uygulanmaz; programın yeniden üretilmesini bekler. */}
      <p className="text-muted-foreground text-xs">{s.study.planNote}</p>

      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} />
        <FormSuccess show={success} />
      </div>
    </form>
  )
}
