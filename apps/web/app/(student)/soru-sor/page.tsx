import Link from 'next/link'
import { buttonVariants } from '@zihin/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { AskForm } from '@/components/help/ask-form'
import { RequestList, type RequestListItem } from '@/components/help/request-list'
import { helpStrings } from '@/components/help/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  countRequestsInWindow,
  getDailyQuestionLimit,
  getHelpSubjects,
  getHelpTopics,
  getSubjectNames,
  getTopicTitles,
  listStudentRequests,
} from '@/lib/data/help'
import { formatDateTime, previewText } from '@/lib/help/format'
import { quotaState, turkeyDayWindow } from '@/lib/help/limits'
import { fill } from '@/lib/i18n'

/**
 * Soru Sor ekranı (spec §M11, ekran §9.13).
 *
 * Kalan kota BURADA, sunucuda hesaplanır ve forma yalnızca sayı olarak geçer.
 * Arayüzün kotayı göstermesi bir kolaylıktır; asıl denetim action'dadır
 * (`askQuestion` her gönderimde yeniden sayar).
 *
 * Yetki denetimi düzendedir (`(student)/layout.tsx`); burada ayrıca
 * `requireOnboardedStudent()` çağrılır çünkü sayfa kullanıcının sınavına
 * ihtiyaç duyuyor.
 */

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Soru Sor' }

/** Geçmişte gösterilecek en fazla soru. */
const HISTORY_LIMIT = 30

export default async function AskQuestionPage() {
  const s = helpStrings()
  const user = await requireOnboardedStudent()
  const supabase = await createSupabaseServerClient()

  const requests = await listStudentRequests(supabase, user.id, HISTORY_LIMIT)

  const window = turkeyDayWindow(new Date())
  const limit = await getDailyQuestionLimit(supabase, user.id)
  const used = await countRequestsInWindow(supabase, user.id, window)
  const quota = quotaState(limit, used)

  const subjectNames = await getSubjectNames(
    supabase,
    requests.flatMap((request) => (request.subject_id ? [request.subject_id] : [])),
  )
  const topicTitles = await getTopicTitles(
    supabase,
    requests.flatMap((request) => (request.topic_id ? [request.topic_id] : [])),
  )

  const items: RequestListItem[] = requests.map((request) => ({
    id: request.id,
    status: request.status,
    hasPendingMatches: request.status === 'open' && request.matched_question_ids.length > 0,
    subjectName: request.subject_id ? (subjectNames.get(request.subject_id) ?? null) : null,
    topicTitle: request.topic_id ? (topicTitles.get(request.topic_id) ?? null) : null,
    preview: previewText(request.body, s.teacherNoBody),
    createdAtLabel: formatDateTime(request.created_at),
    answeredAtLabel: request.answered_at ? formatDateTime(request.answered_at) : null,
  }))

  if (!user.examId) {
    return (
      <div className="space-y-6">
        <PageHeader title={s.title} description={s.description} />
        <EmptyState
          title={s.studentsNoExam}
          description={s.description}
          action={
            <Link href="/ayarlar" className={buttonVariants({ variant: 'outline' })}>
              {s.teacherFilterApply}
            </Link>
          }
        />
      </div>
    )
  }

  const subjects = await getHelpSubjects(supabase, user.examId)
  const topics = await getHelpTopics(supabase, user.examId)

  return (
    <div className="space-y-8">
      <PageHeader title={s.title} description={s.description} />

      <Card>
        <CardHeader>
          <CardTitle>{s.formTitle}</CardTitle>
          <CardDescription>
            {quota.limit === 0
              ? s.quotaZero
              : `${fill(s.quotaUsed, { used: quota.used, limit: quota.limit })} · ${
                  quota.exhausted
                    ? s.quotaExhausted
                    : fill(s.quotaRemaining, { remaining: quota.remaining })
                }`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AskForm
            userId={user.id}
            subjects={subjects}
            topics={topics}
            remaining={quota.remaining}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-semibold">{s.historyTitle}</h2>
        <RequestList items={items} />
      </section>
    </div>
  )
}
