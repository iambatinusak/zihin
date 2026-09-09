import { Info } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { UserFilters } from '@/components/admin/users/user-filters'
import { UserTable } from '@/components/admin/users/user-table'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getEmailIndex, listAdminUsers } from '@/lib/data/admin'
import { fill, t } from '@/lib/i18n'
import { USERS_PER_PAGE, UserListParamsSchema } from './schemas'

/**
 * Kullanıcı yönetimi (spec §M15). YALNIZCA `admin`.
 *
 * `(admin)` düzeni editörü de içeri alır; bu sayfa onu `requireRole('admin')`
 * ile kendi ana sayfasına geri yollar. Sayfanın gizlenmesi TEK BAŞINA yeterli
 * değildir — bu ekrandaki her işlem ayrıca `assertRole('admin')` ile korunur
 * (bkz. `actions.ts`).
 *
 * E-posta `auth.users` içindedir ve PostgREST'e kapalıdır; dizin service-role
 * ile, YETKİ DENETİMİNDEN SONRA okunur.
 */

export const metadata = { title: 'Kullanıcılar' }
export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireRole('admin')

  const raw = await searchParams
  const params = UserListParamsSchema.parse({
    q: single(raw.q),
    role: single(raw.role),
    page: single(raw.page) ?? 1,
  })

  const supabase = await createSupabaseServerClient()
  const emails = await getEmailIndex(createSupabaseAdminClient())

  const page = await listAdminUsers(supabase, emails, {
    query: params.q,
    role: params.role,
    page: params.page,
    perPage: USERS_PER_PAGE,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.usersTitle')}
        description={t('admin.usersSubtitle')}
        breadcrumb={[
          { label: 'Yönetim', href: '/admin/dashboard' },
          { label: t('admin.usersTitle') },
        ]}
      />

      <UserFilters />

      <div className="border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>{t('admin.usersEmailLimit')}</p>
      </div>

      <p className="text-muted-foreground text-sm" aria-live="polite">
        {fill(t('admin.usersTotal'), { count: page.total })}
      </p>

      {page.rows.length === 0 ? (
        <EmptyState title={t('admin.usersEmptyTitle')} description={t('admin.usersEmptyBody')} />
      ) : (
        <UserTable
          page={page}
          currentUserId={admin.id}
          query={params.q ?? ''}
          role={params.role ?? ''}
        />
      )}
    </div>
  )
}

/** Aynı anahtar birden çok kez verilmişse ilki alınır. */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}
