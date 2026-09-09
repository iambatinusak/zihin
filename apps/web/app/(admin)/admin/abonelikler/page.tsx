import { Info } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { GrantSubscriptionForm } from '@/components/billing/grant-subscription-form'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActivePackages } from '@/lib/data/billing'
import { t } from '@/lib/i18n'

/**
 * Elle abonelik tanımlama ekranı (spec §M14).
 *
 * Bilinçli olarak KÜÇÜK: tek bir form. Sayfa yalnızca `admin` rolüne açıktır
 * (yönetim menüsünde de yalnızca ona görünür) ama asıl kapı action'ın kendi
 * `assertRole('admin')` denetimidir — sayfayı gizlemek yetki denetimi değildir.
 */

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  await requireRole('admin')

  const supabase = await createSupabaseServerClient()
  const packages = await getActivePackages(supabase)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('billing.adminTitle')}
        description={t('billing.adminSubtitle')}
        breadcrumb={[
          { label: 'Yönetim', href: '/admin/dashboard' },
          { label: t('billing.adminTitle') },
        ]}
      />

      <div className="border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>{t('billing.adminWarning')}</p>
      </div>

      {packages.length === 0 ? (
        <EmptyState title={t('billing.emptyTitle')} description={t('billing.emptyBody')} />
      ) : (
        <GrantSubscriptionForm packages={packages} />
      )}
    </div>
  )
}
