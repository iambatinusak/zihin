import { PageHeader } from '@/components/common/page-header'
import { ImportWizard } from '@/components/admin/questions/import-wizard'
import { questionStrings } from '@/components/admin/questions/strings'
import { requireRole } from '@/lib/auth'

export const metadata = { title: 'Toplu soru içe aktarma' }

/**
 * Toplu içe aktarma ekranı. Sayfanın kendisi hiçbir şey okumaz; tüm iş
 * `previewImport` / `importQuestions` action'larında ve orada rol yeniden
 * denetlenir. Buradaki `requireRole` yalnızca yanlış rolü doğru yere yollar.
 */
export default async function ImportQuestionsPage() {
  await requireRole(['editor', 'admin'])
  const s = questionStrings()

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.importTitle}
        description={s.importDescription}
        breadcrumb={[{ label: s.title, href: '/admin/sorular' }, { label: s.importTitle }]}
      />
      <ImportWizard />
    </div>
  )
}
