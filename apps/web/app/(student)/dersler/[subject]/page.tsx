import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { UnitAccordion } from '@/components/catalog/unit-accordion'
import type { CatalogStrings } from '@/components/catalog/strings'
import { fill } from '@/lib/i18n'
import { rethrowAsNotFound } from '@/components/catalog/not-found'
import { requireOnboardedStudent } from '@/lib/auth'
import { getSubjectBySlug, getUnitsWithTopicItems, hasActiveSubscription } from '@/lib/data'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { section } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ subject: string }> }

export default async function SubjectPage({ params }: PageProps) {
  const s = section<CatalogStrings>('catalog')
  const { subject: subjectSlug } = await params
  const user = await requireOnboardedStudent()

  if (!user.examId) redirect('/dersler')

  const supabase = await createSupabaseServerClient()
  const subject = await getSubjectBySlug(supabase, user.examId, subjectSlug).catch(
    rethrowAsNotFound,
  )

  const [units, subscribed] = await Promise.all([
    getUnitsWithTopicItems(supabase, subject.id, user.id),
    hasActiveSubscription(supabase, user.id),
  ])

  const topicCount = units.reduce((sum, unit) => sum + unit.topics.length, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={subject.name}
        description={fill(s.subjectMeta, { units: units.length, topics: topicCount })}
        breadcrumb={[{ label: s.breadcrumbRoot, href: '/dersler' }, { label: subject.name }]}
      />

      {units.length === 0 ? (
        <EmptyState title={s.noUnitsTitle} description={s.noUnitsDescription} />
      ) : (
        <UnitAccordion subjectSlug={subject.slug} units={units} hasSubscription={subscribed} />
      )}
    </div>
  )
}
