import Link from 'next/link'
import { Clock, ListChecks, RotateCcw, ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@zihin/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState } from '@/components/common/empty-state'
import { StartPlacementButton } from '@/components/placement/start-placement-button'
import { placementStrings } from '@/components/placement/strings'
import { requireOnboardedStudent } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getPlacementStatus } from '@/lib/data/placement'

/**
 * Seviye tespit sınavının giriş ekranı (spec §M7).
 *
 * Sınav burada ÇÖZÜLMEZ: düğme sunucuda bir oturum açar ve öğrenciyi var olan
 * `/test/[sessionId]` motoruna yollar. Bu sayfa yalnızca ne olacağını anlatır
 * ve atlama seçeneğini görünür kılar — atlamak spec'te desteklenen bir yol,
 * gizlenmiş bir kaçış değil.
 */

export const metadata = { title: 'Seviye Tespit Sınavı' }
export const dynamic = 'force-dynamic'

export default async function PlacementPage() {
  const s = placementStrings()
  const user = await requireOnboardedStudent('/seviye-tespit')

  if (!user.examId) {
    return (
      <div className="space-y-6">
        <PageHeader title={s.title} description={s.subtitle} />
        <EmptyState
          title={s.noExamTitle}
          description={s.noExamBody}
          action={
            <Link href="/ayarlar" className={buttonVariants({ variant: 'default' })}>
              {s.goSettings}
            </Link>
          }
        />
      </div>
    )
  }

  const supabase = await createSupabaseServerClient()
  const status = await getPlacementStatus(supabase, user.id)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={s.title} description={s.subtitle} />

      {status.completed && status.completedSessionId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{s.doneTitle}</CardTitle>
            <CardDescription>{s.doneBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href={`/sonuc/${status.completedSessionId}`}
              className={buttonVariants({ variant: 'default' })}
            >
              {s.viewResult}
            </Link>
            <Link href="/dersler" className={buttonVariants({ variant: 'outline' })}>
              {s.skip}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{s.title}</CardTitle>
          <CardDescription>{s.intro}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <ul className="space-y-3">
            <Rule
              icon={<ListChecks aria-hidden="true" className="size-4" />}
              text={s.ruleQuestions}
            />
            <Rule icon={<Clock aria-hidden="true" className="size-4" />} text={s.ruleDuration} />
            <Rule icon={<RotateCcw aria-hidden="true" className="size-4" />} text={s.ruleResume} />
            <Rule
              icon={<ShieldCheck aria-hidden="true" className="size-4" />}
              text={s.ruleHonest}
            />
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <StartPlacementButton>
              {status.resumableSessionId ? s.resume : s.start}
            </StartPlacementButton>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: 'ghost', size: 'default' })}
            >
              {s.skip}
            </Link>
          </div>

          <p className="text-muted-foreground text-sm">{s.skipHint}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Rule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <span className="pt-1">{text}</span>
    </li>
  )
}
