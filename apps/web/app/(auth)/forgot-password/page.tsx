import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { t } from '@/lib/i18n'

export const metadata: Metadata = { title: 'Şifremi unuttum' }

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('auth.forgotTitle')}</CardTitle>
        <CardDescription>{t('auth.forgotSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <ForgotPasswordForm />

        <p className="text-center text-sm">
          <Link href="/login" className="text-primary underline underline-offset-4">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
