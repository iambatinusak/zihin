import { PageHeader } from '@/components/common/page-header'
import { QueueList, type QueueItem } from '@/components/help/queue-list'
import { SubjectFilter } from '@/components/help/subject-filter'
import { helpStrings } from '@/components/help/strings'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  getDisplayNames,
  getSubjectNames,
  getTopicTitles,
  listQueueRequests,
} from '@/lib/data/help'
import { formatWaiting, previewText } from '@/lib/help/format'

/**
 * Öğretmen soru kuyruğu (spec §M11, ekran §9.13).
 *
 * Yalnızca AÇIK sorular, EN ESKİDEN yeniye — en uzun bekleyen öğrenci en
 * üstte. Ders süzgeci düz bir GET formudur, seçim adres çubuğunda taşınır.
 *
 * Yetki: `(teacher)/layout.tsx` düzeni `teacher`/`admin` istiyor; sayfa yine de
 * kendi denetimini yapar (CONVENTIONS §3 — düzenin guard'ına yaslanmayız).
 */

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Gelen Sorular' }

const QUEUE_LIMIT = 100

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TeacherQuestionsPage({ searchParams }: PageProps) {
  const s = helpStrings()
  await requireRole(['teacher', 'admin'])

  const params = await searchParams
  const selectedSubjectId = firstValue(params.ders)

  const supabase = await createSupabaseServerClient()

  // Süzgeç seçenekleri kuyruğun KENDİSİNDEN türer: öğretmenin bir sınavı yok,
  // bu yüzden "tüm dersler" listesi yerine bekleyen soruların dersleri.
  const allOpen = await listQueueRequests(supabase, { limit: QUEUE_LIMIT })
  const subjectNames = await getSubjectNames(
    supabase,
    allOpen.flatMap((request) => (request.subject_id ? [request.subject_id] : [])),
  )

  const requests = selectedSubjectId
    ? allOpen.filter((request) => request.subject_id === selectedSubjectId)
    : allOpen

  const topicTitles = await getTopicTitles(
    supabase,
    requests.flatMap((request) => (request.topic_id ? [request.topic_id] : [])),
  )

  // Öğrencinin GÖRÜNEN adı; gerekçesi lib/data/help.ts → getDisplayNames.
  const displayNames = await getDisplayNames(
    createSupabaseAdminClient(),
    requests.map((request) => request.student_id),
  )

  const now = new Date()
  const items: QueueItem[] = requests.map((request) => ({
    id: request.id,
    studentName: displayNames.get(request.student_id)?.trim() || s.teacherStudentLabel,
    subjectName: request.subject_id ? (subjectNames.get(request.subject_id) ?? null) : null,
    topicTitle: request.topic_id ? (topicTitles.get(request.topic_id) ?? null) : null,
    preview: previewText(request.body, s.teacherNoBody),
    waitingLabel: formatWaiting(request.created_at, now),
    hasImage: Boolean(request.image_url),
  }))

  const subjectOptions = [...subjectNames.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  return (
    <div className="space-y-6">
      <PageHeader title={s.teacherTitle} description={s.teacherDescription} />

      <SubjectFilter
        subjects={subjectOptions}
        selectedId={selectedSubjectId}
        action="/ogretmen/sorular"
      />

      <QueueList items={items} />
    </div>
  )
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
