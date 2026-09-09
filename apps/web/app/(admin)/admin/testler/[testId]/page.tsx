import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/common/page-header'
import { TestDetailEditor } from '@/components/admin/media/test-detail-editor'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminTest, getAdminTestQuestions } from '@/lib/data/admin-media'
import { AppError } from '@/lib/errors'
import { t } from '@/lib/i18n'

/** Test/deneme ayrıntısı: üst bilgi + soru sırası (spec §M15). */

export const metadata: Metadata = { title: 'Testi düzenle' }
export const dynamic = 'force-dynamic'

export default async function AdminTestDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  await requireRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const { testId } = await params

  const test = await getAdminTest(supabase, testId).catch((error: unknown) => {
    if (error instanceof AppError && error.code === 'not_found') notFound()
    throw error
  })

  const questions = await getAdminTestQuestions(supabase, test.id)
  const isMock = test.type === 'mock_exam'

  return (
    <div className="space-y-6">
      <PageHeader
        title={test.title}
        breadcrumb={[
          { label: t('adminMedia.breadcrumbRoot'), href: '/admin/dashboard' },
          isMock
            ? { label: t('adminMedia.mockTitle'), href: '/admin/denemeler' }
            : { label: t('adminMedia.testsTitle'), href: '/admin/testler' },
          { label: test.title },
        ]}
      />

      <TestDetailEditor
        test={test}
        questions={questions}
        topicIds={test.topic_id === null ? [] : [test.topic_id]}
        canAddQuestions={!isMock}
      />
    </div>
  )
}
