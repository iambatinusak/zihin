'use client'

import { useState, type FormEvent } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@zihin/ui/avatar'
import { Input } from '@zihin/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@zihin/ui/select'
import { updateProfile } from '@/app/(student)/ayarlar/actions'
import { GRADES, type Grade } from '@/app/(student)/ayarlar/schemas'
import { section, t } from '@/lib/i18n/settings'
import { Field, FormErrorSummary, FormSuccess, SubmitButton } from '@/components/common/form-parts'
import { useSettingsAction } from './use-settings-action'

type ProfileFormProps = {
  fullName: string
  displayName: string
  avatarUrl: string
  grade: Grade | null
}

/** Sınıf seçiminde "boş" değeri; Radix `SelectItem` boş string kabul etmez. */
const NO_GRADE = 'yok'

const s = section<{
  profile: Record<string, string>
  grades: Record<string, string>
}>('settings')

export function ProfileForm(initial: ProfileFormProps) {
  const [fullName, setFullName] = useState(initial.fullName)
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl)
  const [grade, setGrade] = useState<string>(initial.grade ?? NO_GRADE)

  const { submit, pending, error, success, fieldError } = useSettingsAction(updateProfile)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit({
      fullName,
      displayName,
      avatarUrl,
      grade: grade === NO_GRADE ? '' : grade,
    })
  }

  const initials = (displayName || fullName || '?').trim().slice(0, 2).toLocaleUpperCase('tr-TR')

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormErrorSummary message={error} />

      <div className="flex items-center gap-3">
        <Avatar className="size-14">
          {avatarUrl.startsWith('https://') ? (
            <AvatarImage src={avatarUrl} alt={t('settings.profile.avatarPreview')} />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <p className="text-muted-foreground text-xs">{s.profile.avatarUrlHint}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="ayar-ad-soyad"
          label={t('settings.profile.fullName')}
          hint={s.profile.fullNameHint}
          error={fieldError('fullName')}
        >
          {(props) => (
            <Input
              {...props}
              name="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
            />
          )}
        </Field>

        <Field
          id="ayar-gorunen-ad"
          label={t('settings.profile.displayName')}
          hint={s.profile.displayNameHint}
          error={fieldError('displayName')}
        >
          {(props) => (
            <Input
              {...props}
              name="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
              maxLength={24}
            />
          )}
        </Field>

        <Field
          id="ayar-avatar"
          label={t('settings.profile.avatarUrl')}
          error={fieldError('avatarUrl')}
          className="sm:col-span-2"
        >
          {(props) => (
            <Input
              {...props}
              name="avatarUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          )}
        </Field>

        <Field id="ayar-sinif" label={t('settings.profile.grade')} error={fieldError('grade')}>
          {(props) => (
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger {...props} className="w-full">
                <SelectValue placeholder={s.profile.gradePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GRADE}>{s.profile.gradeNone}</SelectItem>
                {GRADES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {s.grades[value] ?? value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pending={pending} />
        <FormSuccess show={success} />
      </div>
    </form>
  )
}
