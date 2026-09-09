'use client'

import * as React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@zihin/ui/button'
import { Input } from '@zihin/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@zihin/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@zihin/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zihin/ui/dropdown-menu'
import { Field, FormErrorSummary, SubmitButton } from '@/components/common/form-parts'
import { fill, t } from '@/lib/i18n/admin'
import { ROLES, ROLE_LABELS, type Role } from '@/lib/roles'
import {
  anonymizeUser,
  changeUserRole,
  setUserSuspension,
} from '@/app/(admin)/admin/kullanicilar/actions'
import { ANONYMIZE_CONFIRMATION } from '@/app/(admin)/admin/kullanicilar/schemas'

/**
 * Kullanıcı satırının işlemleri: rol, askı, anonimleştirme.
 *
 * Üçü de YALNIZCA yöneticiye açıktır ve bunu sağlayan şey bu menü değil,
 * action'ların kendi `assertRole('admin')` denetimidir. Menü zaten yalnızca
 * yönetici için basılıyor (`/admin/kullanicilar` sayfası `requireRole('admin')`
 * ile korunuyor) — ama arayüz güvenlik sınırı değildir.
 */

type UserRowActionsProps = {
  userId: string
  name: string
  role: Role
  suspended: boolean
  /** Yönetici kendi satırında rol/askı işlemi yapamaz; menü de bunu göstermez. */
  isSelf: boolean
}

export function UserRowActions({ userId, name, role, suspended, isSelf }: UserRowActionsProps) {
  const [dialog, setDialog] = React.useState<'role' | 'suspension' | 'anonymize' | null>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={fill(t('admin.rowMenu'), { name })}>
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isSelf} onSelect={() => setDialog('role')}>
            {t('admin.changeRole')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isSelf} onSelect={() => setDialog('suspension')}>
            {suspended ? t('admin.reactivate') : t('admin.suspend')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf}
            className="text-destructive focus:text-destructive"
            onSelect={() => setDialog('anonymize')}
          >
            {t('admin.anonymize')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'role' ? (
        <ChangeRoleDialog userId={userId} name={name} role={role} onClose={() => setDialog(null)} />
      ) : null}

      {dialog === 'suspension' ? (
        <SuspensionDialog
          userId={userId}
          name={name}
          suspended={suspended}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'anonymize' ? (
        <AnonymizeDialog userId={userId} name={name} onClose={() => setDialog(null)} />
      ) : null}
    </>
  )
}

/* ──────────────────────────── Rol değiştirme ────────────────────────────── */

function ChangeRoleDialog({
  userId,
  name,
  role,
  onClose,
}: {
  userId: string
  name: string
  role: Role
  onClose: () => void
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fill(t('admin.changeRoleTitle'), { name })}</DialogTitle>
          <DialogDescription>{t('admin.changeRoleBody')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            setError(null)
            startTransition(async () => {
              const result = await changeUserRole({
                userId,
                role: String(data.get('role') ?? ''),
              })
              if (!result.ok) {
                setError(result.error.message)
                return
              }
              toast.success(fill(t('admin.roleChanged'), { role: result.data.roleLabel }))
              onClose()
            })
          }}
        >
          <FormErrorSummary message={error} />

          <Field id="role" label={t('admin.colRole')}>
            {(aria) => (
              <select
                {...aria}
                name="role"
                defaultValue={role}
                className="border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px]"
              >
                {ROLES.map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('admin.cancel')}
            </Button>
            <SubmitButton pending={pending} label={t('admin.changeRoleSubmit')} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────────────────── Askıya alma / etkinleştirme ────────────────────── */

function SuspensionDialog({
  userId,
  name,
  suspended,
  onClose,
}: {
  userId: string
  name: string
  suspended: boolean
  onClose: () => void
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const next = !suspended

  return (
    <AlertDialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {fill(t(next ? 'admin.suspendTitle' : 'admin.reactivateTitle'), { name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(next ? 'admin.suspendBody' : 'admin.reactivateBody')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('admin.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              setError(null)
              startTransition(async () => {
                const result = await setUserSuspension({ userId, suspended: next })
                if (!result.ok) {
                  setError(result.error.message)
                  return
                }
                toast.success(t(next ? 'admin.suspended' : 'admin.reactivated'))
                onClose()
              })
            }}
          >
            {t(next ? 'admin.suspend' : 'admin.reactivate')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ────────────────────────── KVKK anonimleştirme ─────────────────────────── */

/**
 * Geri alınamaz işlem: yazılı onay istenir.
 *
 * Onay metni burada da, sunucuda da denetlenir. Buradaki denetim yalnızca
 * kullanıcıyı yanlışlıkla tıklamaktan korur; asıl kapı `anonymizeUser`
 * action'ının kendi kontrolüdür.
 */
function AnonymizeDialog({
  userId,
  name,
  onClose,
}: {
  userId: string
  name: string
  onClose: () => void
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [confirmation, setConfirmation] = React.useState('')
  const matches = confirmation.trim() === ANONYMIZE_CONFIRMATION

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fill(t('admin.anonymizeTitle'), { name })}</DialogTitle>
          <DialogDescription>{t('admin.anonymizeKept')}</DialogDescription>
        </DialogHeader>

        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {t('admin.anonymizeWarning')}
        </div>
        <p className="text-muted-foreground text-sm">{t('admin.anonymizeAlsoSuspends')}</p>

        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            startTransition(async () => {
              const result = await anonymizeUser({ userId, confirmation })
              if (!result.ok) {
                setError(result.error.message)
                return
              }
              toast.success(t('admin.anonymized'))
              onClose()
            })
          }}
        >
          <FormErrorSummary message={error} />

          <Field
            id="confirmation"
            label={fill(t('admin.anonymizeConfirmLabel'), { word: ANONYMIZE_CONFIRMATION })}
          >
            {(aria) => (
              <Input
                {...aria}
                name="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('admin.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || !matches}>
              {t('admin.anonymizeSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
