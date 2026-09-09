import type { Metadata } from 'next'
import Link from 'next/link'
import { Flame, Star, Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@zihin/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { ParentLinkForm } from '@/components/parent/link-form'
import { parentStrings } from '@/components/parent/strings'
import { studentHref } from '@/lib/parent/select'
import { requireRole } from '@/lib/auth'
import { getLinkedStudents, type LinkedStudent } from '@/lib/data'
import { section } from '@/lib/i18n'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/*
 * Bağlı öğrenciler ve yeni bağlantı formu.
 *
 * Buradaki tek "işlem" davet koduyla bağlanmaktır (Faz 2'den gelen
 * `linkParentByInviteCode`). Öğrenci satırından çıkan bağlantı yalnızca yine
 * veli paneline gider; içeriğe açılan hiçbir yol yoktur (spec §M12).
 */

export const metadata: Metadata = { title: 'Öğrencilerim' }

export const dynamic = 'force-dynamic'

type ParentStrings = {
  studentsTitle: string
  emptyTitle: string
  emptyDescription: string
  gradeLabel: string
  gradeUnknown: string
  levelLabel: string
  streakLabel: string
  streakUnit: string
  xpLabel: string
  nameless: string
  limitNote: string
  grades: Record<string, string>
}

export default async function ParentStudentsPage() {
  const user = await requireRole('parent')
  const supabase = await createSupabaseServerClient()
  const students = await getLinkedStudents(supabase, user.id)

  const legacy = section<ParentStrings>('parent')
  const s = parentStrings()
  const linkStrings = section<{ formTitle: string; formDescription: string }>('link')

  return (
    <div className="space-y-6">
      <PageHeader title={s.studentsTitle} description={s.studentsDescription} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{legacy.studentsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <EmptyState title={legacy.emptyTitle} description={legacy.emptyDescription} />
          ) : (
            <ul className="divide-border divide-y">
              {students.map((student) => (
                <StudentRow key={student.id} student={student} strings={legacy} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{linkStrings.formTitle}</CardTitle>
          <CardDescription>{linkStrings.formDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ParentLinkForm />
          <p className="text-muted-foreground text-xs">{legacy.limitNote}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function StudentRow({ student, strings }: { student: LinkedStudent; strings: ParentStrings }) {
  const s = parentStrings()
  const name = student.displayName?.trim() || student.fullName?.trim() || strings.nameless
  const grade = student.grade ? (strings.grades[student.grade] ?? student.grade) : null

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10">
          {student.avatarUrl ? <AvatarImage src={student.avatarUrl} alt="" /> : null}
          <AvatarFallback>{name.slice(0, 2).toLocaleUpperCase('tr-TR')}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-muted-foreground text-xs">
            {strings.gradeLabel}: {grade ?? strings.gradeUnknown}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <dl className="flex items-center gap-5">
          <Stat
            icon={<Trophy aria-hidden="true" className="size-4" />}
            label={strings.levelLabel}
            value={String(student.level)}
          />
          <Stat
            icon={<Star aria-hidden="true" className="size-4" />}
            label={strings.xpLabel}
            value={String(student.xp)}
          />
          <Stat
            icon={<Flame aria-hidden="true" className="size-4" />}
            label={strings.streakLabel}
            value={`${student.currentStreak} ${strings.streakUnit}`}
          />
        </dl>

        {/* Tek bağlantı: yine veli paneli. İçeriğe açılan bir yol yok. */}
        <Link
          href={studentHref('/veli', student.id)}
          className="text-primary hover:text-primary/80 focus-visible:ring-ring rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          {s.title}
        </Link>
      </div>
    </li>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="text-foreground text-sm font-medium tabular-nums">{value}</dd>
      </div>
    </div>
  )
}
