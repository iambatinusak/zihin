import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { Separator } from '@zihin/ui/separator'
import { RegisterForm } from '@/components/auth/register-form'
import { GoogleButton } from '@/components/auth/google-button'
import { t } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Kayıt ol' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode
  const initialMode = modeParam === 'parent' ? 'parent' : 'student'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('auth.registerTitle')}</CardTitle>
        <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <RegisterForm initialMode={initialMode} />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs uppercase">{t('auth.or')}</span>
          <Separator className="flex-1" />
        </div>

        <GoogleButton />

        <p className="text-muted-foreground text-center text-sm">
          {t('auth.hasAccount')}{' '}
          <Link href="/login" className="text-primary underline underline-offset-4">
            {t('auth.login')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
