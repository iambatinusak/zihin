import { PageHeader } from '@/components/common/page-header'
import { QuestionForm } from '@/components/admin/questions/question-form'
import { questionStrings } from '@/components/admin/questions/strings'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTopicOptions } from '@/lib/data/admin-questions'

export const metadata = { title: 'Yeni soru' }

/** Yeni soru ekranı. Okunacak bir doğru cevap yok; RSC istemcisi yeterli. */
export default async function NewQuestionPage() {
  const user = await requireRole(['editor', 'admin'])
  const s = questionStrings()

  const supabase = await createSupabaseServerClient()
  const topics = await getTopicOptions(supabase)

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.editorNewTitle}
        description={s.editorDescription}
        breadcrumb={[{ label: s.title, href: '/admin/sorular' }, { label: s.editorNewTitle }]}
      />

      <QuestionForm userId={user.id} topics={topics} outcomes={[]} question={null} />
    </div>
  )
}
