import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { CurriculumTree } from '@/components/admin/curriculum/curriculum-tree'
import { requireRole } from '@/lib/auth'
import { CONTENT_ROLES } from '@/lib/roles'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurriculumTree } from '@/lib/data/admin'
import { t } from '@/lib/i18n'

/**
 * Müfredat düzenleyicisi (spec §M15).
 *
 * Editör ve yönetici ortak: müfredat içeriktir. Sayfa guard'ı yalnızca ekranı
 * gizler; asıl denetim `actions.ts` içindeki `assertRole(CONTENT_ROLES)`
 * çağrılarındadır.
 */

export const metadata = { title: 'Müfredat' }
export const dynamic = 'force-dynamic'

export default async function AdminCurriculumPage() {
  await requireRole(CONTENT_ROLES)

  const supabase = await createSupabaseServerClient()
  const tree = await getCurriculumTree(supabase)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.curriculumTitle')}
        description={t('admin.curriculumSubtitle')}
        breadcrumb={[{ label: 'Yönetim' }, { label: t('admin.curriculumTitle') }]}
      />

      {tree.length === 0 ? (
        <EmptyState
          title={t('admin.curriculumEmptyTitle')}
          description={t('admin.curriculumEmptyBody')}
        />
      ) : null}

      <CurriculumTree tree={tree} />
    </div>
  )
}
