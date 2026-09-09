import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { t } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Yeni şifre belirleyin' }

/**
 * Sıfırlama sayfası. Buraya yalnızca e-postadaki bağlantı üzerinden gelinir:
 * `/auth/callback` kodu kurtarma oturumuna çevirir, bu sayfa da o oturumu okur.
 */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('auth.resetTitle')}</CardTitle>
        <CardDescription>{t('auth.resetSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {user ? (
          <ResetPasswordForm />
        ) : (
          <>
            <p
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {t('auth.resetNoSession')}
            </p>
            <p className="text-center text-sm">
              <Link href="/forgot-password" className="text-primary underline underline-offset-4">
                {t('auth.resetRequestNew')}
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
