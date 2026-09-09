import { redirect } from 'next/navigation'
import { Clock, Gauge, Scale } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { MasteryBadge } from '@/components/common/mastery-badge'
import { TopicTabs } from '@/components/catalog/topic-tabs'
import type { CatalogStrings } from '@/components/catalog/strings'
import { rethrowAsNotFound } from '@/components/catalog/not-found'
import { requireOnboardedStudent } from '@/lib/auth'
import { getTopicDetail, hasActiveSubscription } from '@/lib/data'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { section } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ subject: string; unit: string; topic: string }> }

export default async function TopicPage({ params }: PageProps) {
  const s = section<CatalogStrings>('catalog')
  const { subject: subjectSlug, unit: unitSlug, topic: topicSlug } = await params
  const user = await requireOnboardedStudent()

  if (!user.examId) redirect('/dersler')

  const supabase = await createSupabaseServerClient()
  const detail = await getTopicDetail(supabase, {
    examId: user.examId,
    subjectSlug,
    unitSlug,
    topicSlug,
    userId: user.id,
  }).catch(rethrowAsNotFound)

  const subscribed = await hasActiveSubscription(supabase, user.id)
  const { topic, unit, subject, mastery } = detail

  return (
    <div className="space-y-6">
      <PageHeader
        title={topic.title}
        breadcrumb={[
          { label: s.breadcrumbRoot, href: '/dersler' },
          { label: subject.name, href: `/dersler/${subject.slug}` },
          // Ünitenin ayrı bir sayfası yok; kırıntıda bağlantısız durur.
          { label: unit.name },
          { label: topic.title },
        ]}
        actions={
          mastery ? (
            <MasteryBadge mastery={mastery.mastery} attempts={mastery.attempts_count} showScore />
          ) : (
            <MasteryBadge status="unknown" />
          )
        }
      />

      <dl
        aria-label={s.topicHeaderMeta}
        className="border-border grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-3"
      >
        <MetaItem
          icon={<Clock aria-hidden="true" className="size-4" />}
          label={s.estimatedMinutes}
          value={`${topic.estimated_minutes} ${s.unitMinutes}`}
        />
        <MetaItem
          icon={<Gauge aria-hidden="true" className="size-4" />}
          label={s.difficulty}
          value={`${topic.difficulty} / 5`}
        />
        <MetaItem
          icon={<Scale aria-hidden="true" className="size-4" />}
          label={s.examWeight}
          value={`%${topic.exam_weight}`}
        />
      </dl>

      <TopicTabs detail={detail} hasSubscription={subscribed} />
    </div>
  )
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="text-foreground text-sm font-medium tabular-nums">{value}</dd>
      </div>
    </div>
  )
}
