'use client'

// Next.js hata sınırı yalnızca Client Component olabilir: `reset` bir işleyicidir.
import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@zihin/ui/button'
import { ErrorState } from '@/components/common/error-state'
import { t } from '@/lib/i18n/base'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Kullanıcıya iç detay gösterilmez; kayıt sunucu günlüğüne düşer.
    console.error('[error-boundary]', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-4">
      <ErrorState
        title={t('states.errorTitle')}
        description={t('states.errorDescription')}
        onRetry={reset}
        className="w-full"
      />
      <Button asChild variant="ghost">
        <Link href="/">{t('common.goHome')}</Link>
      </Button>
    </div>
  )
}
