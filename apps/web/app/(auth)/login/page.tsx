import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { Separator } from '@zihin/ui/separator'
import { LoginForm } from '@/components/auth/login-form'
import { GoogleButton } from '@/components/auth/google-button'
import { t } from '@/lib/i18n'
import { isSafeRedirect } from '../redirect'

export const metadata: Metadata = { title: 'Giriş yap' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const nextRaw = first(params.next)
  // Güvensiz `next` değeri hiç taşınmaz; forma yalnızca doğrulanmış yol geçer.
  const next = isSafeRedirect(nextRaw) ? nextRaw : undefined
  const hasError = first(params.error) !== undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('auth.loginTitle')}</CardTitle>
        <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <LoginForm next={next} initialError={hasError ? t('auth.callbackFailed') : undefined} />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs uppercase">{t('auth.or')}</span>
          <Separator className="flex-1" />
        </div>

        <GoogleButton next={next} />

        <p className="text-muted-foreground text-center text-sm">
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="text-primary underline underline-offset-4">
            {t('auth.register')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
