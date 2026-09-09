'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@zihin/ui/avatar'
import { Button } from '@zihin/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@zihin/ui/alert-dialog'
import { unlinkParent } from '@/app/(student)/ayarlar/actions'
import { section, t } from '@/lib/i18n/settings'
import { FormErrorSummary } from '@/components/common/form-parts'
import { useSettingsAction } from './use-settings-action'

export type LinkedParentView = {
  id: string
  name: string
  avatarUrl: string | null
  linkedAt: string
}

type InviteCardProps = {
  inviteCode: string | null
  parents: LinkedParentView[]
}

const s = section<{
  codeLabel: string
  copy: string
  copied: string
  copyFailed: string
  noCode: string
  canSeeTitle: string
  canSee: string[]
  cannotSeeTitle: string
  cannotSee: string[]
  limitNote: string
  linkedTitle: string
  linkedEmpty: string
  linkedSince: string
  unlink: string
  unlinkTitle: string
  unlinkBody: string
  unlinkConfirm: string
  unlinked: string
  unlinking: string
}>('link')

export function InviteCard({ inviteCode, parents }: InviteCardProps) {
  return (
    <div className="space-y-6">
      <InviteCode code={inviteCode} />

      <div className="grid gap-4 sm:grid-cols-2">
        <PermissionList title={s.canSeeTitle} items={s.canSee} tone="allow" />
        <PermissionList title={s.cannotSeeTitle} items={s.cannotSee} tone="deny" />
      </div>

      <p className="text-muted-foreground text-xs">{s.limitNote}</p>

      <LinkedParents parents={parents} />
    </div>
  )
}

function InviteCode({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false)

  if (!code) {
    return <p className="text-muted-foreground text-sm">{s.noCode}</p>
  }

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(s.copied)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Güvenli olmayan bağlam ya da izin reddi: kullanıcıya elle yazması söylenir.
      toast.error(s.copyFailed)
    }
  }

  return (
    <div className="space-y-2">
      <p id="davet-kodu-etiket" className="text-sm font-medium">
        {s.codeLabel}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <output
          aria-labelledby="davet-kodu-etiket"
          className="border-border bg-muted text-foreground flex-1 rounded-lg border px-4 py-4 text-center font-mono text-2xl font-semibold tracking-[0.35em] sm:text-3xl"
        >
          {code}
        </output>
        <Button type="button" variant="outline" onClick={copy} className="sm:h-14 sm:px-6">
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          {s.copy}
        </Button>
      </div>
    </div>
  )
}

function PermissionList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'allow' | 'deny'
}) {
  const Icon = tone === 'allow' ? ShieldCheck : ShieldX

  return (
    <div className="border-border rounded-lg border p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Icon
          aria-hidden="true"
          className={tone === 'allow' ? 'text-primary size-4' : 'text-muted-foreground size-4'}
        />
        {title}
      </h3>
      <ul className="text-muted-foreground mt-2 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LinkedParents({ parents }: { parents: LinkedParentView[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{s.linkedTitle}</h3>
      {parents.length === 0 ? (
        <p className="text-muted-foreground text-sm">{s.linkedEmpty}</p>
      ) : (
        <ul className="divide-border divide-y">
          {parents.map((parent) => (
            <ParentRow key={parent.id} parent={parent} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ParentRow({ parent }: { parent: LinkedParentView }) {
  const [open, setOpen] = useState(false)
  const { submit, pending, error } = useSettingsAction(unlinkParent)

  function confirm() {
    submit(
      { parentId: parent.id },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success(s.unlinked)
        },
      },
    )
  }

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          {parent.avatarUrl ? <AvatarImage src={parent.avatarUrl} alt="" /> : null}
          <AvatarFallback>{parent.name.slice(0, 2).toLocaleUpperCase('tr-TR')}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{parent.name}</p>
          <p className="text-muted-foreground text-xs">
            {s.linkedSince}: {formatDate(parent.linkedAt)}
          </p>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {s.unlink}
            <span className="sr-only"> — {parent.name}</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.unlinkTitle}</AlertDialogTitle>
            <AlertDialogDescription>{s.unlinkBody}</AlertDialogDescription>
          </AlertDialogHeader>

          <FormErrorSummary message={error} />

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('common.cancel')}</AlertDialogCancel>
            {/* onSelect engellenir: iletişim kutusu istek bitmeden kapanmasın. */}
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                confirm()
              }}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {pending ? s.unlinking : s.unlinkConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

const DATE_FORMAT = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date)
}
