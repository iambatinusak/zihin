'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { resetPassword } from '@/app/(auth)/actions'
import { ResetPasswordSchema } from '@/app/(auth)/schemas'
import { LiveRegion } from '@/components/common/live-region'
import { t } from '@/lib/i18n/auth'
import {
  Field,
  FormErrorSummary,
  PasswordInput,
  SubmitButton,
  type FieldErrors,
} from '@/components/common/form-parts'

export function ResetPasswordForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = ResetPasswordSchema.safeParse({
      password: String(form.get('password') ?? ''),
      passwordConfirm: String(form.get('passwordConfirm') ?? ''),
    })

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors)
      return
    }

    setFieldErrors({})
    setFormError(null)

    startTransition(async () => {
      const result = await resetPassword(parsed.data)
      if (!result.ok) {
        setFormError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }
      setDone(true)
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormErrorSummary message={formError} />

      <LiveRegion message={done ? t('auth.resetDone') : ''} />
      {done ? <p className="text-muted-foreground text-sm">{t('auth.resetDone')}</p> : null}

      <Field
        id="password"
        label={t('auth.password')}
        hint={t('auth.passwordHint')}
        error={fieldErrors.password}
      >
        {(props) => (
          <PasswordInput {...props} name="password" autoComplete="new-password" required />
        )}
      </Field>

      <Field
        id="passwordConfirm"
        label={t('auth.passwordAgain')}
        error={fieldErrors.passwordConfirm}
      >
        {(props) => (
          <PasswordInput {...props} name="passwordConfirm" autoComplete="new-password" required />
        )}
      </Field>

      <SubmitButton
        pending={pending || done}
        label={t('auth.resetSubmit')}
        pendingLabel={t('auth.resetPending')}
      />
    </form>
  )
}
