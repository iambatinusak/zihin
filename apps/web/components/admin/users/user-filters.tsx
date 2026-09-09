'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Input } from '@zihin/ui/input'
import { Field } from '@/components/common/form-parts'
import { t } from '@/lib/i18n/admin'
import { ROLES, ROLE_LABELS } from '@/lib/roles'

/**
 * Arama ve rol süzgeci.
 *
 * Durum URL'de tutulur (`?q=&role=&page=`): sonuç paylaşılabilir, geri tuşu
 * çalışır ve liste sunucuda üretilmeye devam eder. Süzgeç değişince `page`
 * bilerek DÜŞÜRÜLÜR — 7. sayfadayken arama yapıp boş sonuç görmek kafa
 * karıştırıcıdır.
 */
export function UserFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  const currentQuery = params.get('q') ?? ''
  const currentRole = params.get('role') ?? ''

  function apply(query: string, role: string) {
    const next = new URLSearchParams()
    if (query.trim().length > 0) next.set('q', query.trim())
    if (role.length > 0) next.set('role', role)
    startTransition(() => router.push(`${pathname}?${next.toString()}`))
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        apply(String(data.get('q') ?? ''), String(data.get('role') ?? ''))
      }}
    >
      <Field id="q" label={t('admin.usersSearch')} className="min-w-56 flex-1">
        {(aria) => (
          <Input
            {...aria}
            name="q"
            type="search"
            defaultValue={currentQuery}
            placeholder={t('admin.usersSearchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>

      <Field id="role" label={t('admin.usersRoleFilter')} className="w-48">
        {(aria) => (
          <select
            {...aria}
            name="role"
            defaultValue={currentRole}
            className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px]"
          >
            <option value="">{t('admin.usersAllRoles')}</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="flex items-center gap-2 pb-0.5">
        <Button type="submit" disabled={pending}>
          <Search aria-hidden="true" className="size-4" />
          {t('admin.usersApply')}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => apply('', '')}>
          {t('admin.usersReset')}
        </Button>
      </div>
    </form>
  )
}
