import Link from 'next/link'
import { buttonVariants } from '@zihin/ui/button'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { SubjectCard } from '@/components/catalog/subject-card'
import type { CatalogStrings } from '@/components/catalog/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { getSubjectOverviews } from '@/lib/data'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { section } from '@/lib/i18n'

/*
 * Kullanıcıya özel veri (yetkinlik) okunduğu için sayfa dinamiktir;
 * `generateStaticParams` ya da statik önbellek burada anlamsız olurdu.
 */
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Dersler' }

export default async function SubjectsPage() {
  const s = section<CatalogStrings>('catalog')
  // Guard düzende (app/(student)/layout.tsx) çalıştı; burada yalnızca
  // kullanıcının kimliği ve sınavı için okunuyor.
  const user = await requireOnboardedStudent()

  if (!user.examId) {
    return (
      <div className="space-y-6">
        <PageHeader title={s.title} description={s.description} />
        <EmptyState
          title={s.noExamTitle}
          description={s.noExamDescription}
          action={
            <Link href="/onboarding" className={buttonVariants({ size: 'sm' })}>
              {s.noExamAction}
            </Link>
          }
        />
      </div>
    )
  }

  const supabase = await createSupabaseServerClient()
  const subjects = await getSubjectOverviews(supabase, user.examId, user.id)

  return (
    <div className="space-y-6">
      <PageHeader title={s.title} description={s.description} />

      {subjects.length === 0 ? (
        <EmptyState title={s.noSubjectsTitle} description={s.noSubjectsDescription} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      )}
    </div>
  )
}
