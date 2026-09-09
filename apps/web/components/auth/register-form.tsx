'use client'

// Sekme seçimi, alan doğrulaması ve bekleme durumu istemcide yaşıyor.
import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@zihin/ui/checkbox'
import { Input } from '@zihin/ui/input'
import { cn } from '@zihin/ui/lib/utils'
import { registerParent, registerStudent } from '@/app/(auth)/actions'
import { RegisterParentSchema, RegisterStudentSchema } from '@/app/(auth)/schemas'
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@/lib/invite-code'
import { t } from '@/lib/i18n/auth'
import {
  Field,
  FormErrorSummary,
  PasswordInput,
  SubmitButton,
  type FieldErrors,
} from '@/components/common/form-parts'

type Mode = 'student' | 'parent'

const MODES: { value: Mode; label: string }[] = [
  { value: 'student', label: t('auth.modeStudent') },
  { value: 'parent', label: t('auth.modeParent') },
]

export function RegisterForm({ initialMode = 'student' }: { initialMode?: Mode }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [inviteCode, setInviteCode] = useState('')
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function switchMode(next: Mode) {
    setMode(next)
    setInviteCode('')
    setFieldErrors({})
    setFormError(null)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const base = {
      fullName: String(form.get('fullName') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      passwordConfirm: String(form.get('passwordConfirm') ?? ''),
      kvkkConsent: form.get('kvkkConsent') === 'on',
    }

    setFormError(null)

    if (mode === 'parent') {
      const parsed = RegisterParentSchema.safeParse({
        ...base,
        inviteCode,
      })
      if (!parsed.success) {
        setFieldErrors(parsed.error.flatten().fieldErrors)
        return
      }
      setFieldErrors({})
      submit(() => registerParent(parsed.data), parsed.data.email)
      return
    }

    const parsed = RegisterStudentSchema.safeParse(base)
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors)
      return
    }
    setFieldErrors({})
    submit(() => registerStudent(parsed.data), parsed.data.email)
  }

  function submit(
    run: () => Promise<
      | { ok: true; data: { email: string } }
      | { ok: false; error: { message: string; fieldErrors?: Record<string, string[]> } }
    >,
    email: string,
  ) {
    startTransition(async () => {
      const result = await run()
      if (!result.ok) {
        setFormError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }
      router.replace(`/verify?email=${encodeURIComponent(email)}`)
    })
  }

  return (
    <div className="space-y-5">
      <div role="group" aria-label={t('auth.modeLabel')} className="bg-muted flex rounded-lg p-1">
        {MODES.map((item) => {
          const active = mode === item.value
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              onClick={() => switchMode(item.value)}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <p className="text-muted-foreground text-sm">
        {mode === 'parent' ? t('auth.parentIntro') : t('auth.studentIntro')}
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormErrorSummary message={formError} />

        <Field id="fullName" label={t('auth.fullName')} error={fieldErrors.fullName}>
          {(props) => <Input {...props} name="fullName" autoComplete="name" required />}
        </Field>

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

        {mode === 'parent' ? (
          <Field
            id="inviteCode"
            label={t('auth.inviteCode')}
            hint={t('auth.inviteCodeHint')}
            error={fieldErrors.inviteCode}
          >
            {(props) => (
              <Input
                {...props}
                name="inviteCode"
                value={inviteCode}
                // Kod sözlü paylaşılıyor; tire ve boşluk normalleştirmede atılır.
                // maxLength bu yüzden normalleştirilmiş değere uygulanır.
                onChange={(event) => setInviteCode(normalizeInviteCode(event.target.value))}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={INVITE_CODE_LENGTH}
                className="font-mono uppercase tracking-widest"
                required
              />
            )}
          </Field>
        ) : null}

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

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Checkbox
              id="kvkkConsent"
              name="kvkkConsent"
              aria-invalid={fieldErrors.kvkkConsent ? true : undefined}
              aria-describedby={fieldErrors.kvkkConsent ? 'kvkkConsent-hata' : undefined}
              className="mt-0.5"
            />
            <label htmlFor="kvkkConsent" className="text-sm leading-snug">
              {t('auth.kvkkLabel')}{' '}
              <Link
                href="/kvkk"
                target="_blank"
                // Yeni sekme açan bağlantı hedef sayfaya `window.opener` vermemeli.
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                {t('auth.kvkkLink')}
                <span className="sr-only"> {t('common.opensInNewTab')}</span>
              </Link>
            </label>
          </div>
          {fieldErrors.kvkkConsent ? (
            <p id="kvkkConsent-hata" className="text-destructive text-xs font-medium">
              {fieldErrors.kvkkConsent[0]}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">{t('auth.minorNote')}</p>
        </div>

        <SubmitButton
          fullWidth
          pending={pending}
          label={t('auth.register')}
          pendingLabel={t('auth.registerPending')}
        />
      </form>
    </div>
  )
}
