import { notFound } from 'next/navigation'
import { Button } from '@zihin/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { MockPaymentNotice } from '@/components/billing/mock-payment-notice'
import { isMockBilling } from '@/lib/billing'
import { t } from '@/lib/i18n'

/**
 * Sahte ödeme sayfası — YALNIZCA sahte sağlayıcı devredeyken erişilebilir.
 *
 * Gerçek sağlayıcı yapılandırıldığında bu sayfa `notFound()` döner; yoksa
 * üretimde "ödemeyi tamamla" düğmesi bedava abonelik kapısı olurdu.
 *
 * Düğme, token'ı webhook rotasına POST eder. Yani sahte akış da gerçeği taklit
 * eder: abonelik yine yalnızca doğrulanmış webhook'ta açılır, bu sayfa hiçbir
 * şey yazmaz.
 */
export default async function MockPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  if (!isMockBilling()) notFound()

  const { token } = await searchParams

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 py-8">
      <MockPaymentNotice />

      <Card>
        <CardHeader>
          <CardTitle>{t('billing.mockPayTitle')}</CardTitle>
          <CardDescription>{t('billing.mockPayBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <form method="post" action="/api/webhooks/iyzico">
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full">
                {t('billing.mockPayConfirm')}
              </Button>
            </form>
          ) : (
            <p role="alert" className="text-destructive text-sm font-medium">
              {t('billing.mockPayMissing')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
