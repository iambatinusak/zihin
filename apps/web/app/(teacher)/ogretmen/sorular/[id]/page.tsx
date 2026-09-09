import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@zihin/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@zihin/ui/card'
import { PageHeader } from '@/components/common/page-header'
import { Markdown } from '@/components/common/markdown'
import { AnswerForm } from '@/components/help/answer-form'
import { Conversation, type ConversationMessage } from '@/components/help/conversation'
import { RequestSummary } from '@/components/help/request-summary'
import { helpStrings } from '@/components/help/strings'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  createSignedHelpImageUrl,
  getDisplayNames,
  getHelpRequest,
  getSubjectNames,
  getTopicTitles,
  listHelpMessages,
} from '@/lib/data/help'
import { MAX_MESSAGES_PER_REQUEST } from '@/lib/help/db-errors'
import { formatDateTime } from '@/lib/help/format'

/**
 * Öğretmenin soru ayrıntısı ve yanıt ekranı (spec §M11).
 *
 * Öğrenci burada yalnızca GÖRÜNEN adıyla anılır. Yanıt markdown + LaTeX olarak
 * yazılır ve paylaşılan işleyiciyle SUNUCUDA basılır.
 */

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Soru Yanıtla' }

export default async function TeacherQuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const s = helpStrings()
  const { id } = await params
  await requireRole(['teacher', 'admin'])
  const supabase = await createSupabaseServerClient()

  const request = await getHelpRequest(supabase, id).catch(() => null)
  if (!request) notFound()

  const messages = await listHelpMessages(supabase, request.id)

  const subjectNames = request.subject_id
    ? await getSubjectNames(supabase, [request.subject_id])
    : new Map<string, string>()
  const topicTitles = request.topic_id
    ? await getTopicTitles(supabase, [request.topic_id])
    : new Map<string, string>()

  const admin = createSupabaseAdminClient()
  const displayNames = await getDisplayNames(admin, [request.student_id])
  const imageUrl = await createSignedHelpImageUrl(admin, request.image_url)
  const messageImageUrls = await Promise.all(
    messages.map((message) => createSignedHelpImageUrl(admin, message.image_url)),
  )

  const conversation: ConversationMessage[] = messages.map((message, index) => ({
    id: message.id,
    // Öğrencinin kendi mesajı dışındaki her şey öğretmen tarafıdır.
    fromTeacher: message.sender_id !== request.student_id,
    body: message.body ? <Markdown content={message.body} className="text-sm" /> : null,
    imageUrl: messageImageUrls[index] ?? null,
    createdAtLabel: formatDateTime(message.created_at),
  }))

  const canAnswer = request.status !== 'closed' && messages.length < MAX_MESSAGES_PER_REQUEST

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.teacherAnswerTitle}
        breadcrumb={[
          { label: s.teacherTitle, href: '/ogretmen/sorular' },
          { label: s.teacherAnswerTitle },
        ]}
        actions={
          <Link
            href="/ogretmen/sorular"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {s.teacherBackToQueue}
          </Link>
        }
      />

      <RequestSummary
        status={request.status}
        subjectName={request.subject_id ? (subjectNames.get(request.subject_id) ?? null) : null}
        topicTitle={request.topic_id ? (topicTitles.get(request.topic_id) ?? null) : null}
        studentName={displayNames.get(request.student_id)?.trim() || s.teacherStudentLabel}
        body={request.body ? <Markdown content={request.body} className="text-sm" /> : null}
        imageUrl={imageUrl}
        createdAtLabel={formatDateTime(request.created_at)}
        answeredAtLabel={request.answered_at ? formatDateTime(request.answered_at) : null}
      />

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-semibold">{s.conversation}</h2>
        <Conversation messages={conversation} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.teacherAnswerTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {canAnswer ? (
            <AnswerForm requestId={request.id} />
          ) : (
            <p className="text-muted-foreground text-sm">
              {request.status === 'closed' ? s.statusClosed : s.messageLimitReached}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
