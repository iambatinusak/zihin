import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { Markdown } from '@/components/common/markdown'
import { Conversation, type ConversationMessage } from '@/components/help/conversation'
import { MessageComposer } from '@/components/help/message-composer'
import { RequestSummary } from '@/components/help/request-summary'
import { SimilarMatches, type SimilarMatchItem } from '@/components/help/similar-matches'
import { helpStrings } from '@/components/help/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveTopicHrefs } from '@/lib/data/dashboard'
import {
  createSignedHelpImageUrl,
  getHelpRequest,
  getPublicQuestionsByIds,
  getSubjectNames,
  getTopicTitles,
  listHelpMessages,
} from '@/lib/data/help'
import { formatDateTime } from '@/lib/help/format'

/**
 * Bir sorunun ayrıntısı ve yazışması (spec §9.13).
 *
 * Markdown (soru metni, öğretmen yanıtı) SUNUCUDA basılır ve bileşenlere hazır
 * düğüm olarak geçer — KaTeX ve temizleme şeması istemci paketine girmez
 * (CONVENTIONS).
 *
 * Fotoğraf `help-uploads` özel kovasındadır; adres her istekte yeniden
 * imzalanır ve imzalama service-role ile yapılır (anahtar veritabanı satırından
 * gelir, istemciden değil).
 */

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Soru Detayı' }

export default async function HelpRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const s = helpStrings()
  const { id } = await params
  const user = await requireOnboardedStudent()
  const supabase = await createSupabaseServerClient()

  const request = await getHelpRequest(supabase, id).catch(() => null)
  // Başkasının sorusu "yok" gibi davranır: varlığını sızdırmanın anlamı yok.
  if (!request || request.student_id !== user.id) notFound()

  const messages = await listHelpMessages(supabase, request.id)

  const subjectNames = request.subject_id
    ? await getSubjectNames(supabase, [request.subject_id])
    : new Map<string, string>()
  const topicTitles = request.topic_id
    ? await getTopicTitles(supabase, [request.topic_id])
    : new Map<string, string>()

  const admin = createSupabaseAdminClient()
  const imageUrl = await createSignedHelpImageUrl(admin, request.image_url)

  const messageImageUrls = await Promise.all(
    messages.map((message) => createSignedHelpImageUrl(admin, message.image_url)),
  )

  const conversation: ConversationMessage[] = messages.map((message, index) => ({
    id: message.id,
    fromTeacher: message.sender_id !== user.id,
    body: message.body ? <Markdown content={message.body} className="text-sm" /> : null,
    imageUrl: messageImageUrls[index] ?? null,
    createdAtLabel: formatDateTime(message.created_at),
  }))

  const pendingMatchIds = request.status === 'open' ? request.matched_question_ids : []
  const matches = await buildMatches(supabase, pendingMatchIds)

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.detailTitle}
        breadcrumb={[{ label: s.title, href: '/soru-sor' }, { label: s.detailTitle }]}
        actions={
          <Link href="/soru-sor" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {s.backToList}
          </Link>
        }
      />

      <RequestSummary
        status={request.status}
        hasPendingMatches={pendingMatchIds.length > 0}
        subjectName={request.subject_id ? (subjectNames.get(request.subject_id) ?? null) : null}
        topicTitle={request.topic_id ? (topicTitles.get(request.topic_id) ?? null) : null}
        body={request.body ? <Markdown content={request.body} className="text-sm" /> : null}
        imageUrl={imageUrl}
        createdAtLabel={formatDateTime(request.created_at)}
        answeredAtLabel={request.answered_at ? formatDateTime(request.answered_at) : null}
      />

      {matches.length > 0 ? <SimilarMatches requestId={request.id} matches={matches} /> : null}

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-semibold">{s.conversation}</h2>
        <Conversation messages={conversation} />
      </section>

      <MessageComposer
        requestId={request.id}
        messageCount={messages.length}
        closed={request.status === 'closed'}
      />
    </div>
  )
}

/** Benzer soruları müfredat bağlantılarıyla birlikte hazırlar. */
async function buildMatches(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  questionIds: readonly string[],
): Promise<SimilarMatchItem[]> {
  if (questionIds.length === 0) return []

  const questions = await getPublicQuestionsByIds(supabase, questionIds)
  if (questions.length === 0) return []

  const hrefs = await resolveTopicHrefs(
    supabase,
    questions.map((question) => question.topicId),
  )
  const titles = await getTopicTitles(
    supabase,
    questions.map((question) => question.topicId),
  )

  // Sıra `matched_question_ids` sırasıdır: sunucu onları benzerliğe göre
  // sıralamıştı, `in()` sorgusu bu sırayı korumaz.
  const byId = new Map(questions.map((question) => [question.id, question]))

  return questionIds.flatMap((questionId) => {
    const question = byId.get(questionId)
    if (!question) return []
    return [
      {
        questionId: question.id,
        stem: <Markdown content={question.stem} className="text-sm" />,
        topicHref: hrefs.get(question.topicId) ?? null,
        topicTitle: titles.get(question.topicId) ?? null,
        // Benzerlik puanı satırda saklanmıyor (0007: yalnızca kimlik dizisi);
        // sonradan uydurulmuş bir yüzde göstermek yerine hiç gösterilmez.
        similarity: null,
      },
    ]
  })
}
