'use client'

// Etkin bağlantıyı işaretlemek için geçerli yolu okumak gerekiyor (usePathname).
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@zihin/ui/lib/utils'
import { ScrollArea } from '@zihin/ui/scroll-area'
import { t } from '@/lib/i18n/base'
import type { Role } from '@/lib/roles'
import { isNavItemActive, navForRole } from './nav-config'

type AppSidebarProps = {
  role: Role
  /**
   * `vertical` kenar çubuğu ve mobil çekmece için, `horizontal` veli/öğretmen
   * düzenlerindeki tek satırlık sekme şeridi için.
   */
  orientation?: 'vertical' | 'horizontal'
  /** Mobil Sheet içinde bir bağlantıya tıklanınca paneli kapatmak için. */
  onNavigate?: () => void
  className?: string
}

/** Rol duyarlı gezinme. Kenar çubuğu, mobil Sheet ve yatay şerit aynı modeli kullanır. */
export function AppSidebar({
  role,
  orientation = 'vertical',
  onNavigate,
  className,
}: AppSidebarProps) {
  const pathname = usePathname()
  const sections = navForRole(role)
  const horizontal = orientation === 'horizontal'

  const list = (
    <div className={cn(horizontal ? 'flex items-center gap-1 p-2' : 'space-y-6 p-3')}>
      {sections.map((section, index) => (
        <div
          key={section.titleKey ?? `section-${index}`}
          className={cn(horizontal ? 'contents' : 'space-y-1')}
        >
          {section.titleKey && !horizontal ? (
            <h2 className="text-muted-foreground px-3 pb-1 text-xs font-semibold uppercase tracking-wide">
              {t(section.titleKey)}
            </h2>
          ) : null}

          <ul className={cn(horizontal ? 'flex items-center gap-1' : 'space-y-1')}>
            {section.items.map((item) => {
              const active = isNavItemActive(item, pathname)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      horizontal ? 'whitespace-nowrap' : 'gap-3',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )

  return (
    <nav aria-label={t('shell.mainNav')} className={cn(horizontal ? '' : 'h-full', className)}>
      {horizontal ? (
        <ScrollArea className="w-full">{list}</ScrollArea>
      ) : (
        <ScrollArea className="h-full">{list}</ScrollArea>
      )}
    </nav>
  )
}
