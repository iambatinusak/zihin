'use client'

// Sheet'in açık/kapalı durumu istemcide tutulur; bağlantıya tıklanınca kapanır.
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@zihin/ui/sheet'
import { APP_NAME } from '@/lib/env'
import { t } from '@/lib/i18n/base'
import type { Role } from '@/lib/roles'
import { AppSidebar } from './app-sidebar'

/** md altında kenar çubuğunun yerini alan çekmece menü. */
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('shell.openMenu')}>
          <Menu aria-hidden="true" className="size-5" />
          <span className="sr-only">{t('shell.openMenu')}</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-border border-b p-4">
          <SheetTitle className="text-left">{APP_NAME}</SheetTitle>
        </SheetHeader>
        <AppSidebar role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
