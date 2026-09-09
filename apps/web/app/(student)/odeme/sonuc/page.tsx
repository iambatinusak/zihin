import Link from 'next/link'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Card, CardContent } from '@zihin/ui/card'
import { fill, t } from '@/lib/i18n'
import { requireOnboardedStudent } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActiveSubscription } from '@/lib/data/billing'

/**
 * Ödeme dönüş ekranı.
 *
 * ── BURASI BİR KARAR EKRANI DEĞİL, BİR BİLDİRİM EKRANIDIR ──────────────────
 * URL'deki `durum` parametresi yalnızca hangi metnin gösterileceğini seçer;
 * hiçbir şey yazmaz, hiçbir erişim açmaz. Kullanıcı adres çubuğuna
 * `?durum=success` yazsa bile aboneliği olmaz — erişim `subscriptions`
 * satırından okunur, o satırı da yalnızca doğrulanmış webhook açar.
 * Gösterilen abonelik bilgisi bu yüzden veritabanından teyit edilir.
 */
export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>
}) {
  const user = await requireOnboardedStudent()
  const { durum } = await searchParams

  const supabase = await createSupabaseServerClient()
  const subscription = await getActiveSubscription(supabase, user.id)

  // Gerçek durum: aboneliği varsa başarılı sayılır, parametre ne derse desin.
  const state: 'success' | 'pending' | 'failed' = subscription
    ? 'success'
    : durum === 'failed'
      ? 'failed'
      : 'pending'

  const view = VIEWS[state]
  const Icon = view.icon

  return (
    <div className="mx-auto w-full max-w-lg py-8">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <Icon aria-hidden="true" className={`size-10 ${view.tone}`} />
          <h1 className="text-foreground text-xl font-semibold">{t(view.titleKey)}</h1>
          <p className="text-muted-foreground max-w-sm text-sm">{t(view.bodyKey)}</p>

          {subscription ? (
            <p className="text-muted-foreground text-sm">
              {fill(t('billing.activeUntil'), {
                date: new Date(subscription.ends_at).toLocaleDateString('tr-TR'),
              })}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/dashboard">{t('billing.resultGoDashboard')}</Link>
            </Button>
            {state === 'success' ? null : (
              <Button asChild variant="outline">
                <Link href="/paketler">{t('billing.resultRetry')}</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const VIEWS = {
  success: {
    icon: CheckCircle2,
    tone: 'text-mastery-strong',
    titleKey: 'billing.resultSuccessTitle',
    bodyKey: 'billing.resultSuccessBody',
  },
  pending: {
    icon: Clock,
    tone: 'text-mastery-medium',
    titleKey: 'billing.resultPendingTitle',
    bodyKey: 'billing.resultPendingBody',
  },
  failed: {
    icon: XCircle,
    tone: 'text-destructive',
    titleKey: 'billing.resultFailedTitle',
    bodyKey: 'billing.resultFailedBody',
  },
} as const
