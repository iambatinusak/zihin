import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/common/page-header'
import { QuestionForm } from '@/components/admin/questions/question-form'
import { questionStrings } from '@/components/admin/questions/strings'
import { requireRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getOutcomesForTopic,
  getQuestionForEdit,
  getTopicOptions,
} from '@/lib/data/admin-questions'

export const metadata = { title: 'Soruyu düzenle' }

/**
 * Soru düzenleme ekranı.
 *
 * DOĞRU CEVABIN OKUNDUĞU TEK YER. `correct_option` ve `explanation` kolonları
 * `authenticated` rolünden geri alınmıştır (0011), bu yüzden okuma SERVICE-ROLE
 * istemcisiyle yapılır — ama YALNIZCA `requireRole(['editor','admin'])`
 * geçtikten sonra ve yalnızca bu sunucu bileşeninde. Buradan istemciye giden
 * veri editörün kendi düzenlediği sorudur; öğrenciye giden hiçbir yüzey bu
 * yoldan beslenmez.
 */
export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['editor', 'admin'])
  const { id } = await params
  const s = questionStrings()

  const admin = createSupabaseAdminClient()

  let question
  try {
    question = await getQuestionForEdit(admin, id)
  } catch (error) {
    if (error instanceof AppError && error.code === 'not_found') notFound()
    throw error
  }

  const supabase = await createSupabaseServerClient()
  const [topics, outcomes] = await Promise.all([
    getTopicOptions(supabase),
    getOutcomesForTopic(supabase, question.topicId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.editorEditTitle}
        description={s.editorDescription}
        breadcrumb={[{ label: s.title, href: '/admin/sorular' }, { label: s.editorEditTitle }]}
      />

      <QuestionForm userId={user.id} topics={topics} outcomes={outcomes} question={question} />
    </div>
  )
}
