import Link from 'next/link'
import { Info } from 'lucide-react'
import { buttonVariants } from '@zihin/ui/button'
import { EmptyState } from '@/components/common/empty-state'
import { getLinkedStudents, type LinkedStudent } from '@/lib/data'
import {
  getRecentMockResults,
  getWeakTopics,
  getWeeklyComparison,
  type ParentWeakTopic,
} from '@/lib/data/parent'
import { resolveSelectedStudent } from '@/lib/parent/select'
import { previousWeekStart, resolveWeekStart } from '@/lib/parent/week'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { RecentMocksCard } from './recent-mocks-card'
import { StudentSelector } from './student-selector'
import { parentStrings, studentLabel } from './strings'
import { WeeklySummaryCard } from './summary-card'
import { WeakTopicsCard } from './weak-topics-card'
import { WeekNav } from './week-nav'

type OverviewProps = {
  parentId: string
  /** Seçim ve hafta bağlantılarının döneceği yol. */
  basePath: string
  studentParam?: string
  weekParam?: string
  /** Hafta gezinmesi yalnızca rapor sayfasında açıktır. */
  showWeekNav?: boolean
  now?: Date
}

/**
 * Veli panelinin gövdesi: öğrenci seçici, haftalık özet, zayıf konular ve son
 * denemeler. `/veli` ile `/veli/raporlar` aynı gövdeyi paylaşır; aralarındaki
 * tek fark hafta gezinmesidir.
 *
 * SEÇİM SUNUCUDA DOĞRULANIR: `?ogrenci=` yalnızca `parent_links`ten gelen
 * kümeyle karşılaştırıldıktan sonra bir sorguya girer (lib/parent/select.ts).
 */
export async function ParentOverview({
  parentId,
  basePath,
  studentParam,
  weekParam,
  showWeekNav = false,
  now = new Date(),
}: OverviewProps) {
  const s = parentStrings()
  const supabase = await createSupabaseServerClient()

  const students = await getLinkedStudents(supabase, parentId)
  const selected = resolveSelectedStudent(students, studentParam)

  if (!selected) {
    return (
      <EmptyState
        title={s.noStudentTitle}
        description={s.noStudentDescription}
        action={
          <Link href="/veli/ogrenciler" className={buttonVariants({ variant: 'default' })}>
            {s.noStudentAction}
          </Link>
        }
      />
    )
  }

  const weekStart = resolveWeekStart(weekParam, now)
  const [{ current, previous }, weakTopics, mocks] = await Promise.all([
    getWeeklyComparison(supabase, selected.id, weekStart, previousWeekStart(weekStart)),
    loadWeakTopics(supabase, selected),
    getRecentMockResults(supabase, selected.id),
  ])

  return (
    <div className="space-y-6">
      <ReadOnlyNotice />

      <StudentSelector
        students={students.map((student) => ({
          id: student.id,
          name: studentLabel(student, s.selector.nameless),
        }))}
        selectedId={selected.id}
        action={basePath}
        weekStart={showWeekNav ? weekStart : undefined}
      />

      {showWeekNav ? (
        <WeekNav basePath={basePath} studentId={selected.id} weekStart={weekStart} now={now} />
      ) : null}

      <WeeklySummaryCard current={current} previous={previous} />

      {selected.examId === null ? (
        <EmptyState title={s.noExamTitle} description={s.noExamDescription} />
      ) : (
        <WeakTopicsCard topics={weakTopics} />
      )}

      <RecentMocksCard results={mocks} />
    </div>
  )
}

/** Sınav seçilmemiş öğrencide yetkinlik ağacı kurulamaz; boş liste döner. */
async function loadWeakTopics(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  student: LinkedStudent,
): Promise<ParentWeakTopic[]> {
  if (!student.examId) return []
  return getWeakTopics(supabase, student.id, student.examId)
}

/**
 * Gizlilik sınırının görünür hâli: panelin hiçbir yerinde içeriğe geçiş yok.
 * Bunu yazmak, olmayan düğmeleri açıklamaktan daha dürüst.
 */
function ReadOnlyNotice() {
  const s = parentStrings()
  return (
    <p className="text-muted-foreground bg-muted/40 border-border flex items-start gap-2 rounded-lg border p-3 text-xs">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {s.readOnlyNotice}
    </p>
  )
}
