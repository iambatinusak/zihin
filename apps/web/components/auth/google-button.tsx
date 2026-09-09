'use client'

// OAuth akışı tarayıcıdan başlar: Supabase kullanıcıyı sağlayıcıya yönlendirir.
import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { t } from '@/lib/i18n/auth'
import { FormErrorSummary } from '@/components/common/form-parts'

/** Google logosu — marka renkleri tasarım belirteci değildir, olduğu gibi kalır. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="size-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

/**
 * Google ile giriş. Sağlayıcı yapılandırılmamışsa (yerelde varsayılan durum)
 * Supabase bir hata döner; boş ekran yerine okunur bir Türkçe mesaj gösterilir.
 */
export function GoogleButton({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function start() {
    setError(null)
    startTransition(async () => {
      const callback = new URL('/auth/callback', window.location.origin)
      if (next) callback.searchParams.set('next', next)

      // TIKLAMAYA KADAR İNDİRİLMEZ. `@supabase/supabase-js` istemci paketinde
      // ~189 kB tutuyor ve /login ile /register'da BAŞKA hiçbir şey tarayıcı
      // istemcisine dokunmuyor: form bir Server Action'a gidiyor. Statik import
      // olduğu sürece Google'ı hiç kullanmayan her ziyaretçi bu yükü indirir.
      const { getBrowserClient } = await import('@/lib/supabase/client')

      const { data, error: oauthError } = await getBrowserClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback.toString() },
      })

      if (oauthError || !data?.url) {
        setError(t('auth.googleUnavailable'))
        return
      }
      window.location.assign(data.url)
    })
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={start}>
        {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <GoogleMark />}
        {pending ? t('auth.googlePending') : t('auth.loginWithGoogle')}
      </Button>
      <FormErrorSummary message={error} />
    </div>
  )
}
