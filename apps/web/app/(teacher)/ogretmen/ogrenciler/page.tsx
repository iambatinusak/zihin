import { Badge } from '@zihin/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { helpStrings } from '@/components/help/strings'
import { requireRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAssignedStudents, getMasterySummaries } from '@/lib/data/help'
import { fill } from '@/lib/i18n'

/**
 * Öğretmenin öğrenci listesi (spec §M11 yan ekranı).
 *
 * SALT OKUNUR. Öğretmen buradan öğrencinin denemesine, yetkinliğine ya da
 * programına yazamaz; sayfa yalnızca `profiles` ve `topic_mastery` okur ve her
 * ikisi de RLS'te atamaya bağlıdır (`can_read_student_data`, 0010/0011).
 *
 * Ortalama, ÖLÇÜLMÜŞ konular üzerinden hesaplanır: `unknown` durumundaki konu
 * bir puan değildir, ortalamayı aşağı çekmemeli.
 */

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Öğrencilerim' }

export default async function TeacherStudentsPage() {
  const s = helpStrings()
  const teacher = await requireRole(['teacher', 'admin'])
  const supabase = await createSupabaseServerClient()

  const students = await getAssignedStudents(supabase, teacher.id)
  const summaries = await getMasterySummaries(
    supabase,
    students.map((student) => student.id),
  )

  return (
    <div className="space-y-6">
      <PageHeader title={s.studentsTitle} description={s.studentsDescription} />

      {students.length === 0 ? (
        <EmptyState title={s.studentsEmptyTitle} description={s.studentsEmptyBody} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.studentsColumnName}</TableHead>
                <TableHead>{s.studentsColumnGrade}</TableHead>
                <TableHead>{s.studentsColumnMastery}</TableHead>
                <TableHead>{s.studentsColumnMeasured}</TableHead>
                <TableHead>{s.studentsColumnStreak}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const summary = summaries.get(student.id)
                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.displayName}</TableCell>
                    <TableCell>{student.grade ?? '—'}</TableCell>
                    <TableCell>
                      {summary?.averageMastery === null || summary === undefined ? (
                        '—'
                      ) : (
                        <span className="tabular-nums">{summary.averageMastery}</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {summary?.measuredTopics ?? 0}
                      {summary && summary.weakTopics > 0 ? (
                        <Badge variant="outline" className="ml-2">
                          {fill(s.studentsWeakTopics, { count: summary.weakTopics })}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {fill(s.studentsStreakDays, { count: student.currentStreak })}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
