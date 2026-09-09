'use client'

import * as React from 'react'
import { Input } from '@zihin/ui/input'
import { Card, CardContent } from '@zihin/ui/card'
import {
  Field,
  FormErrorSummary,
  FormSuccess,
  SubmitButton,
  type FieldErrors,
} from '@/components/common/form-parts'
import { fill, t } from '@/lib/i18n/billing'
import { formatTry } from '@/lib/billing/money'
import { grantSubscription } from '@/app/(admin)/admin/abonelikler/actions'
import type { BillingPackage } from '@/lib/data/billing'

/**
 * Elle abonelik tanımlama formu.
 *
 * Küçük ve kendi başına. Doğrulamanın tamamı sunucudadır; buradaki `required`
 * yalnızca kullanıcıya kolaylıktır — yetki denetimi `grantSubscription`ın
 * `assertRole('admin')` satırındadır.
 */
export function GrantSubscriptionForm({ packages }: { packages: BillingPackage[] }) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [success, setSuccess] = React.useState<string | null>(null)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    setError(null)
    setFieldErrors({})
    setSuccess(null)

    const rawDuration = String(data.get('durationDays') ?? '').trim()

    startTransition(async () => {
      const result = await grantSubscription({
        email: String(data.get('email') ?? ''),
        packageId: String(data.get('packageId') ?? ''),
        ...(rawDuration === '' ? {} : { durationDays: rawDuration }),
      })

      if (!result.ok) {
        setError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }

      setSuccess(
        fill(t('billing.adminSuccess'), {
          email: result.data.email,
          date: new Date(result.data.endsAt).toLocaleDateString('tr-TR'),
        }),
      )
      form.reset()
    })
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
          <FormErrorSummary message={error} />

          <Field
            id="email"
            label={t('billing.adminEmail')}
            hint={t('billing.adminEmailHint')}
            error={fieldErrors.email}
          >
            {(aria) => (
              <Input
                {...aria}
                name="email"
                type="email"
                required
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            )}
          </Field>

          <Field id="packageId" label={t('billing.adminPackage')} error={fieldErrors.packageId}>
            {(aria) => (
              <select
                {...aria}
                name="packageId"
                required
                defaultValue=""
                className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px]"
              >
                <option value="" disabled>
                  {t('billing.adminPackagePlaceholder')}
                </option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} · {pkg.durationDays} gün · {formatTry(pkg.priceTry)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            id="durationDays"
            label={t('billing.adminDuration')}
            hint={t('billing.adminDurationHint')}
            error={fieldErrors.durationDays}
          >
            {(aria) => (
              <Input {...aria} name="durationDays" type="number" min={1} max={1095} step={1} />
            )}
          </Field>

          <div className="flex items-center gap-3">
            <SubmitButton
              pending={pending}
              label={t('billing.adminSubmit')}
              pendingLabel={t('billing.adminSubmitting')}
            />
            <FormSuccess show={success !== null} message={success ?? undefined} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
