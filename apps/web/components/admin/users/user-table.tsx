import Link from 'next/link'
import { Badge } from '@zihin/ui/badge'
import { buttonVariants } from '@zihin/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import { cn } from '@zihin/ui/lib/utils'
import { fill, t } from '@/lib/i18n'
import { ROLE_LABELS } from '@/lib/roles'
import type { AdminUserPage } from '@/lib/data/admin'
import { UserRowActions } from './user-row-actions'

/**
 * Kullanıcı listesi. Sunucu bileşeni: biçimlendirme ve çeviriler sunucuda
 * yapılır, istemciye yalnızca satır işlemleri menüsü gider.
 */
export function UserTable({
  page,
  currentUserId,
  query,
  role,
}: {
  page: AdminUserPage
  /** Yöneticinin kendi satırı; kendi rolünü/askısını değiştiremez. */
  currentUserId: string
  query: string
  role: string
}) {
  return (
    <div className="space-y-4">
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.colName')}</TableHead>
              <TableHead>{t('admin.colEmail')}</TableHead>
              <TableHead>{t('admin.colRole')}</TableHead>
              <TableHead>{t('admin.colSubscription')}</TableHead>
              <TableHead>{t('admin.colRegistered')}</TableHead>
              <TableHead>{t('admin.colLastActivity')}</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">{t('admin.colActions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {row.displayName ?? row.fullName ?? t('admin.noName')}
                    </span>
                    {row.suspendedAt !== null ? (
                      <Badge variant="destructive" className="w-fit">
                        {t('admin.suspendedBadge')}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.email ?? t('admin.noEmail')}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[row.role]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {row.subscriptionStatus === null || row.subscriptionEndsAt === null
                    ? t('admin.noSubscription')
                    : fill(t('admin.subscriptionUntil'), {
                        date: formatDate(row.subscriptionEndsAt),
                      })}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {row.lastActivityDate === null
                    ? t('admin.noActivity')
                    : formatDate(row.lastActivityDate)}
                </TableCell>
                <TableCell className="text-right">
                  <UserRowActions
                    userId={row.id}
                    name={row.displayName ?? row.fullName ?? t('admin.noName')}
                    role={row.role}
                    suspended={row.suspendedAt !== null}
                    isSelf={row.id === currentUserId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} query={query} role={role} />
    </div>
  )
}

function Pagination({ page, query, role }: { page: AdminUserPage; query: string; role: string }) {
  if (page.pageCount <= 1) return null

  const href = (target: number) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (role) params.set('role', role)
    params.set('page', String(target))
    return `/admin/kullanicilar?${params.toString()}`
  }

  const linkClass = cn(buttonVariants({ variant: 'outline', size: 'sm' }))
  const disabledClass = cn(linkClass, 'pointer-events-none opacity-50')

  return (
    <nav aria-label={t('admin.usersTitle')} className="flex items-center justify-between gap-3">
      {page.page > 1 ? (
        <Link href={href(page.page - 1)} className={linkClass}>
          {t('admin.pagePrev')}
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          {t('admin.pagePrev')}
        </span>
      )}

      <p aria-live="polite" className="text-muted-foreground text-sm">
        {fill(t('admin.pageStatus'), { page: page.page, pageCount: page.pageCount })}
      </p>

      {page.page < page.pageCount ? (
        <Link href={href(page.page + 1)} className={linkClass}>
          {t('admin.pageNext')}
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          {t('admin.pageNext')}
        </span>
      )}
    </nav>
  )
}

/** Tarihler her yerde aynı biçimde: 9 Eylül 2026. */
function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}
