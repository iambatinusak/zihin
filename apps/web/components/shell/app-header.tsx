import Link from 'next/link'
import { BrainCircuit } from 'lucide-react'
import { APP_NAME } from '@/lib/env'
import { t } from '@/lib/i18n'
import { ROLE_HOME, type Role } from '@/lib/roles'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { MobileNav } from './mobile-nav'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

export type AppHeaderProps = {
  role: Role
  name: string
  avatarUrl: string | null
  /** Okunmamış bildirim sayısı; lib/data/notifications.ts'ten gelir. */
  unreadCount: number
  /** Mobil çekmece menüsü gerekmeyen düzenlerde (ör. veli) kapatılabilir. */
  showMobileNav?: boolean
}

/** Her rol düzeninin üst çubuğu. */
export function AppHeader({
  role,
  name,
  avatarUrl,
  unreadCount,
  showMobileNav = true,
}: AppHeaderProps) {
  return (
    <header className="bg-background/95 border-border supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4">
        {showMobileNav ? <MobileNav role={role} /> : null}

        <Link
          href={ROLE_HOME[role]}
          aria-label={t('shell.brandHome')}
          className="flex items-center gap-2 font-semibold"
        >
          <BrainCircuit aria-hidden="true" className="text-primary size-6" />
          <span>{APP_NAME}</span>
        </Link>

        <div className="flex-1" />

        <ThemeToggle />
        <NotificationBell
          initialUnreadCount={unreadCount}
          fullPageHref={role === 'student' ? '/bildirimler' : null}
        />
        <UserMenu name={name} role={role} avatarUrl={avatarUrl} />
      </div>
    </header>
  )
}
