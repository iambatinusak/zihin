import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { MailCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { ResendVerification } from '@/components/auth/resend-verification'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ROLE_HOME, isRole } from '@/lib/roles'
import { t } from '@/lib/i18n'

export const metadata: Metadata = { title: 'E-postanızı doğrulayın' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Zaten doğrulanmışsa bu sayfada oyalanmanın anlamı yok.
  if (user?.email_confirmed_at) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    const roleValue = profile?.role
    const role = isRole(roleValue) ? roleValue : 'student'
    redirect(profile && !profile.onboarding_completed ? '/onboarding' : ROLE_HOME[role])
  }

  const email = emailParam ?? user?.email ?? null

  return (
    <Card>
      <CardHeader>
        <div className="bg-primary/10 mb-2 flex size-10 items-center justify-center rounded-full">
          <MailCheck aria-hidden="true" className="text-primary size-5" />
        </div>
        <CardTitle className="text-xl">{t('auth.verifyEmailTitle')}</CardTitle>
        <CardDescription>{t('auth.verifyExplain')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {email ? (
          <div className="bg-muted/50 rounded-md px-3 py-2 text-sm">
            <p className="text-muted-foreground text-xs">{t('auth.verifySentTo')}</p>
            <p className="break-all font-medium">{email}</p>
          </div>
        ) : (
          <p role="alert" className="text-destructive text-sm">
            {t('auth.verifyNoEmail')}
          </p>
        )}

        <p className="text-muted-foreground text-sm">{t('auth.verifySpam')}</p>

        {email ? <ResendVerification email={email} /> : null}

        <p className="text-center text-sm">
          <Link href="/login" className="text-primary underline underline-offset-4">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
