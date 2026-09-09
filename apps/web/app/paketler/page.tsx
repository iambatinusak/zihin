import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, PlayCircle } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Card, CardContent } from '@zihin/ui/card'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { PackageCard } from '@/components/billing/package-card'
import { MockPaymentNotice } from '@/components/billing/mock-payment-notice'
import { CheckoutButton } from '@/components/billing/checkout-button'
import { getCurrentUser } from '@/lib/auth'
import { getActivePackages, getActiveSubscription, type BillingPackage } from '@/lib/data/billing'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isMockBilling } from '@/lib/billing'
import type { DataClient } from '@/lib/data/client'
import { fill, t } from '@/lib/i18n'
import { APP_NAME } from '@/lib/env'

/**
 * Fiyat sayfası (spec §M14). GİRİŞ YAPMAMIŞ ZİYARETÇİYE DE AÇIKTIR —
 * `middleware.ts` içindeki `PUBLIC_PATHS` listesinde.
 *
 * `packages` tablosunda `anon` rolü için SELECT politikası yok
 * (0011_rls_policies.sql: "fiyat sayfasi ... service_role ile cekilir").
 * Bu yüzden liste service-role istemcisiyle okunur. Sızan bir şey yok:
 * gösterilen alanlar zaten herkese açık pazarlama verisidir ve sorgu hiçbir
 * kullanıcı girdisiyle parametrelenmez (CONVENTIONS §4).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${t('billing.title')} · ${APP_NAME}`,
  description: t('billing.metaDescription'),
}

export default async function PackagesPage() {
  const user = await getCurrentUser()

  const catalog = await readCatalog()
  if (!catalog) {
    return (
      <main id="icerik" className="mx-auto w-full max-w-6xl px-4 py-10 md:py-14">
        <ErrorState title={t('billing.loadFailed')} />
      </main>
    )
  }

  const { packages, examNames } = catalog

  // Aktif abonelik yalnızca giriş yapmış kullanıcı için okunur; okuma
  // kullanıcının kendi istemcisiyle yapılır, RLS geçerli kalsın.
  const activeSubscription = user
    ? await getActiveSubscription(await createSupabaseServerClient(), user.id)
    : null

  return (
    <main id="icerik" className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 md:py-14">
      <PageHeader
        title={t('billing.title')}
        description={t('billing.subtitle')}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft aria-hidden="true" className="size-4" />
              {APP_NAME}
            </Link>
          </Button>
        }
      />

      {isMockBilling() ? <MockPaymentNotice /> : null}

      <Card>
        <CardContent className="flex items-start gap-3 py-5">
          <PlayCircle aria-hidden="true" className="text-primary mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-foreground text-sm font-semibold">{t('billing.freePreviewTitle')}</p>
            <p className="text-muted-foreground text-sm">{t('billing.freePreviewBody')}</p>
          </div>
        </CardContent>
      </Card>

      {packages.length === 0 ? (
        <EmptyState title={t('billing.emptyTitle')} description={t('billing.emptyBody')} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {packages.map((pkg) => {
            const isCurrent = activeSubscription?.package_id === pkg.id
            const highlighted = !isCurrent && matchesUserExam(pkg, user?.examId ?? null)

            return (
              <li key={pkg.id}>
                <PackageCard
                  pkg={pkg}
                  highlighted={highlighted}
                  examName={pkg.examId ? (examNames.get(pkg.examId) ?? null) : null}
                  action={
                    user ? (
                      <CheckoutButton
                        packageId={pkg.id}
                        label={isCurrent ? t('billing.currentPackage') : t('billing.buy')}
                      />
                    ) : (
                      <Button asChild className="w-full">
                        <Link href={`/login?next=${encodeURIComponent('/paketler')}`}>
                          {t('billing.loginToBuy')}
                        </Link>
                      </Button>
                    )
                  }
                  footnote={
                    <p className="text-muted-foreground text-xs">
                      {!user
                        ? t('billing.loginHint')
                        : activeSubscription
                          ? t('billing.extendHint')
                          : null}
                    </p>
                  }
                />
              </li>
            )
          })}
        </ul>
      )}

      {activeSubscription ? (
        <p className="text-muted-foreground text-sm">
          {fill(t('billing.activeUntil'), {
            date: new Date(activeSubscription.ends_at).toLocaleDateString('tr-TR'),
          })}
        </p>
      ) : null}
    </main>
  )
}

/** Paket kullanıcının hedef sınavına mı ait? Sınavdan bağımsız paket öne çıkmaz. */
function matchesUserExam(pkg: BillingPackage, examId: string | null): boolean {
  return examId !== null && pkg.examId === examId
}

type Catalog = { packages: BillingPackage[]; examNames: Map<string, string> }

/**
 * Paketleri ve sınav adlarını okur.
 *
 * Service-role anahtarı tanımlı değilse (yerel geliştirme) oturum istemcisine
 * düşülür: giriş yapmış kullanıcı listeyi yine görür, ziyaretçi göremez.
 * Sayfanın tamamen boş kalmasındansa bu yeğdir.
 */
async function readCatalog(): Promise<Catalog | null> {
  const client = await catalogClient()
  if (!client) return null

  try {
    const packages = await getActivePackages(client)

    const examIds = [...new Set(packages.map((pkg) => pkg.examId).filter(isString))]
    const examNames = new Map<string, string>()

    if (examIds.length > 0) {
      const { data } = await client.from('exams').select('id, name').in('id', examIds)
      for (const row of data ?? []) examNames.set(row.id, row.name)
    }

    return { packages, examNames }
  } catch (error) {
    console.error('[paketler] paket listesi okunamadı:', error)
    return null
  }
}

async function catalogClient(): Promise<DataClient | null> {
  try {
    return createSupabaseAdminClient()
  } catch {
    try {
      return await createSupabaseServerClient()
    } catch {
      return null
    }
  }
}

function isString(value: string | null): value is string {
  return typeof value === 'string'
}
