'use client'

// Form durumu, bekleme kilidi ve hata gösterimi için istemci bileşeni gerekiyor.
import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@zihin/ui/input'
import { signIn } from '@/app/(auth)/actions'
import { SignInSchema } from '@/app/(auth)/schemas'
import { t } from '@/lib/i18n/auth'
import {
  Field,
  FormErrorSummary,
  PasswordInput,
  SubmitButton,
  type FieldErrors,
} from '@/components/common/form-parts'

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(initialError ?? null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const raw = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      next,
    }

    // Sunucuya gitmeden önce aynı şemayla doğrula: hata anında görünsün.
    const parsed = SignInSchema.safeParse(raw)
    if (!parsed.success) {
      setFormError(null)
      setFieldErrors(parsed.error.flatten().fieldErrors)
      return
    }

    setFieldErrors({})
    setFormError(null)

    startTransition(async () => {
      const result = await signIn(parsed.data)
      if (!result.ok) {
        setFormError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  return (
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

      <Field id="password" label={t('auth.password')} error={fieldErrors.password}>
        {(props) => (
          <PasswordInput {...props} name="password" autoComplete="current-password" required />
        )}
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          {t('auth.forgotPassword')}
        </Link>
      </div>

      <SubmitButton
        fullWidth
        pending={pending}
        label={t('auth.login')}
        pendingLabel={t('auth.loginPending')}
      />
    </form>
  )
}
