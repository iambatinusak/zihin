'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { t } from '@/lib/i18n/billing'
import { createCheckout } from '@/app/(student)/odeme/actions'

/**
 * "Paketi al" düğmesi.
 *
 * Yalnızca `packageId` gönderir — tutarı, süreyi ve indirimi sunucu bilir
 * (bkz. app/(student)/odeme/actions.ts). Bu bileşene fiyat propu EKLENMEZ;
 * eklenirse bir gün birinin onu action'a geçirmesi an meselesi olur.
 */
export function CheckoutButton({
  packageId,
  label,
  className,
}: {
  packageId: string
  label?: string
  className?: string
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await createCheckout({ packageId })

      if (!result.ok) {
        setError(result.error.message)
        return
      }

      // Sağlayıcı sayfası uygulamanın dışında olabilir; router değil, tam
      // gezinme kullanılır.
      window.location.assign(result.data.paymentPageUrl)
    })
  }

  return (
    <div className={className}>
      <Button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className="w-full"
      >
        {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        {pending ? t('billing.checkoutPending') : (label ?? t('billing.buy'))}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive mt-2 text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  )
}
