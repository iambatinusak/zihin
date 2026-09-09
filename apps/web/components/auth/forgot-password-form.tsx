'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Input } from '@zihin/ui/input'
import { requestPasswordReset } from '@/app/(auth)/actions'
import { RequestPasswordResetSchema } from '@/app/(auth)/schemas'
import { LiveRegion } from '@/components/common/live-region'
import { t } from '@/lib/i18n/auth'
import {
  Field,
  FormErrorSummary,
  SubmitButton,
  type FieldErrors,
} from '@/components/common/form-parts'

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = RequestPasswordResetSchema.safeParse({
      email: String(form.get('email') ?? ''),
    })

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors)
      return
    }

    setFieldErrors({})
    setFormError(null)

    startTransition(async () => {
      const result = await requestPasswordReset(parsed.data)
      // Adres kayıtlı olsun ya da olmasın aynı mesaj gösterilir; hesabın var
      // olup olmadığı buradan öğrenilemez.
      if (!result.ok) {
        setFormError(result.error.message)
        return
      }
      setSent(true)
    })
  }

  // Onay ekranına geçerken canlı bölge YENİDEN basılmamalı; bu yüzden iki
  // durumun ortak sarmalayıcısında, formdan önce ve her zaman durur.
  const sentMessage = sent ? t('auth.forgotSent') : ''

  return (
    <>
      <LiveRegion message={sentMessage} />
      {sent ? (
        <div className="border-border bg-muted/40 flex items-start gap-2 rounded-md border px-3 py-3 text-sm">
          <CheckCircle2 aria-hidden="true" className="text-primary mt-0.5 size-4 shrink-0" />
          <span>{t('auth.forgotSent')}</span>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormErrorSummary message={formError} />

          <Field id="email" label={t('auth.email')} error={fieldErrors.email}>
            {(props) => (
              <Input
                {...props}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            )}
          </Field>

          <SubmitButton
            fullWidth
            pending={pending}
            label={t('auth.forgotSubmit')}
            pendingLabel={t('auth.forgotPending')}
          />
        </form>
      )}
    </>
  )
}
