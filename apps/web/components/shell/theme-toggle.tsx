'use client'

// next-themes yalnızca istemcide çalışır; ayrıca ilk render'da hangi temanın
// etkin olduğu bilinmediği için mount durumu tutulur.
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@zihin/ui/button'
import { t } from '@/lib/i18n/base'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'
  const label = isDark ? t('shell.themeLight') : t('shell.themeDark')

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`${t('shell.toggleTheme')} — ${label}`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="size-5" />
      ) : (
        <Moon aria-hidden="true" className="size-5" />
      )}
      <span className="sr-only">{t('shell.toggleTheme')}</span>
    </Button>
  )
}
