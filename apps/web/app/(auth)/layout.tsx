import Link from 'next/link'
import { BrainCircuit } from 'lucide-react'
import { APP_NAME } from '@/lib/env'
import { t } from '@/lib/i18n'

/**
 * Giriş, kayıt ve başlangıç adımları için ortalanmış kart düzeni.
 * Gezinme yoktur; kullanıcının tek işi öndeki formu tamamlamaktır.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link
        href="/"
        aria-label={t('shell.brandHome')}
        className="mb-8 flex items-center gap-2 text-lg font-semibold"
      >
        <BrainCircuit aria-hidden="true" className="text-primary size-7" />
        <span>{APP_NAME}</span>
      </Link>

      <main id="icerik" className="w-full max-w-md">
        {children}
      </main>

      <p className="text-muted-foreground mt-8 text-xs">{t('common.appTagline')}</p>
    </div>
  )
}
