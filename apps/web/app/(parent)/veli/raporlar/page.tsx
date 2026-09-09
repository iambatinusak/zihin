import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { ParentOverview } from '@/components/parent/overview'
import { parentStrings } from '@/components/parent/strings'
import { requireRole } from '@/lib/auth'

/*
 * Haftalık rapor — `/veli` ile aynı gövde, üstüne hafta gezinmesi.
 * Sayfa SALT OKUNURDUR; sınırın gerekçesi `app/(parent)/veli/page.tsx`
 * başındaki nottadır. Geçmiş haftaya bakmak da bir okuma işlemidir.
 */

export const metadata: Metadata = { title: 'Raporlar' }

export const dynamic = 'force-dynamic'

export default async function ParentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ ogrenci?: string; hafta?: string }>
}) {
  const user = await requireRole('parent')
  const params = await searchParams
  const s = parentStrings()

  return (
    <div className="space-y-6">
      <PageHeader title={s.reportsTitle} description={s.reportsDescription} />
      <ParentOverview
        parentId={user.id}
        basePath="/veli/raporlar"
        studentParam={params.ogrenci}
        weekParam={params.hafta}
        showWeekNav
      />
    </div>
  )
}
