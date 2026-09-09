'use client'

// Geri sayım ve gönderim durumu istemcide tutuluyor.
import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, RotateCw } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { resendVerification } from '@/app/(auth)/actions'
import { LiveRegion } from '@/components/common/live-region'
import { t } from '@/lib/i18n/auth'
import { FormErrorSummary } from '@/components/common/form-parts'

/** İki gönderim arasındaki en kısa süre (saniye). */
export const RESEND_COOLDOWN_SECONDS = 60

export function ResendVerification({ email }: { email: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [cooldown, setCooldown] = useState(0)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Geri sayım: kullanıcı ne kadar beklemesi gerektiğini görsün.
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Kullanıcı bağlantıya başka bir sekmede tıkladığında bu sayfa kendini
  // tazeler ve doğrulanmış oturumu görürse sunucu yönlendirmesi devreye girer.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000)
    return () => clearInterval(timer)
  }, [router])

  const send = useCallback(() => {
    setError(null)
    setSent(false)
    startTransition(async () => {
      const result = await resendVerification({ email })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setSent(true)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    })
  }, [email])

  const waiting = cooldown > 0

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending || waiting}
        onClick={send}
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <RotateCw aria-hidden="true" className="size-4" />
        )}
        {pending ? t('auth.resendPending') : t('auth.resend')}
      </Button>

      {/* Geri sayım saniyede bir değişiyor; canlı bölge olsaydı ekran okuyucu
          her saniye konuşurdu. Duyurulacak tek olay "gönderildi". */}
      {waiting ? (
        <p aria-live="off" className="text-muted-foreground text-center text-xs">
          {t('auth.resendCountdown').replace('{{seconds}}', String(cooldown))}
        </p>
      ) : null}

      <LiveRegion message={sent ? t('auth.resendDone') : ''} />
      {sent ? (
        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
          <CheckCircle2 aria-hidden="true" className="text-primary size-3.5" />
          {t('auth.resendDone')}
        </p>
      ) : null}

      <FormErrorSummary message={error} />
    </div>
  )
}
