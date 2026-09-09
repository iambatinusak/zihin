'use client'

// Radix DropdownMenu açılır/kapanır durum tutar; istemci bileşeni olmalı.
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@zihin/ui/avatar'
import { Button } from '@zihin/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zihin/ui/dropdown-menu'
import { t } from '@/lib/i18n/base'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { SignOutButton } from './sign-out-button'

export type UserMenuProps = {
  name: string
  role: Role
  avatarUrl: string | null
}

/** Ad, rol etiketi, Ayarlar ve Çıkış. */
export function UserMenu({ name, role, avatarUrl }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="size-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="sr-only">{t('shell.userMenu')}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="text-muted-foreground block text-xs">{ROLE_LABELS[role]}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/ayarlar" className="flex items-center gap-2">
            <Settings aria-hidden="true" className="size-4" />
            <span>{t('nav.settings')}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          // Menü öğesinin kendi tıklaması butonu bastırmasın diye seçim engelleniyor.
          onSelect={(event) => event.preventDefault()}
          className="p-0"
        >
          <SignOutButton className="px-2 py-1.5" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toLocaleUpperCase('tr-TR') || '?'
}
