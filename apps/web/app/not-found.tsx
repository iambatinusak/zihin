import Link from 'next/link'
import { Button } from '@zihin/ui/button'
import { t } from '@/lib/i18n/base'

export const metadata = { title: 'Sayfa bulunamadı' }

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground text-6xl font-semibold tabular-nums">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">{t('states.notFoundTitle')}</h1>
      <p className="text-muted-foreground text-sm">{t('states.notFoundDescription')}</p>
      <Button asChild className="mt-2">
        <Link href="/">{t('common.goHome')}</Link>
      </Button>
    </main>
  )
}
