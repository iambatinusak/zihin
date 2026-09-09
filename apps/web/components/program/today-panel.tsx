import Link from 'next/link'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { buttonVariants } from '@zihin/ui/button'
import { cn } from '@zihin/ui/lib/utils'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getBlocksForDate } from '@/lib/data/plan'
import { todayIso } from '@/lib/plan/week'
import { section } from '@/lib/i18n'
import { blockVisual } from './block-visuals'
import { minutesLabel } from './format'
import type { ProgramStrings } from './strings'

/**
 * "Bugün" paneli — günün çalışma blokları, özet hâlinde.
 *
 * SÖZLEŞME (gösterge paneli ajanı için):
 *   import { TodayPanel } from '@/components/program/today-panel'
 *   <TodayPanel userId={user.id} />              // async Server Component
 *
 *   userId  zorunlu — SUNUCUDA doğrulanmış oturumdan gelmeli
 *                     (`requireOnboardedStudent()`), istemciden değil.
 *   date    isteğe bağlı, "YYYY-MM-DD". Verilmezse Türkiye saatine göre bugün.
 *   className isteğe bağlı, dış kutuya eklenir.
 *
 * Kendi verisini kendisi okur (tek `getBlocksForDate` çağrısı), bu yüzden
 * gösterge paneli hiçbir şey hazırlamak zorunda değildir. `<Suspense>` içine
 * alınabilir. Blok işaretleme/taşıma BURADA YOKTUR: panel salt okunurdur,
 * eylem `/program` ekranındadır — gösterge paneline sürükle-bırak taşımak
 * ikinci bir durum kaynağı yaratırdı.
 */
export async function TodayPanel({
  userId,
  date,
  className,
}: {
  userId: string
  date?: string
  className?: string
}) {
  const s = section<ProgramStrings>('program')
  const today = date ?? todayIso(new Date())

  const supabase = await createSupabaseServerClient()
  const { blocks } = await getBlocksForDate(supabase, userId, today)

  const remaining = blocks.filter((block) => block.completedAt === null)
  const totalMinutes = remaining.reduce((sum, block) => sum + block.estimatedMinutes, 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4" />
          {s.todayTitle}
        </CardTitle>
        <CardDescription>{s.todayDescription}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {blocks.length === 0 ? (
          <p className="text-muted-foreground text-sm">{s.todayEmpty}</p>
        ) : remaining.length === 0 ? (
          <p className="text-foreground flex items-center gap-2 text-sm">
            <CheckCircle2 aria-hidden="true" className="text-mastery-strong size-4" />
            {s.todayAllDone}
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm tabular-nums">
              {remaining.length} {s.todayRemaining} · {minutesLabel(totalMinutes, s.minutesShort)}
            </p>
            <ul className="space-y-2">
              {remaining.map((block) => (
                <li
                  key={block.id}
                  className={cn(
                    'border-border rounded-md border border-l-4 px-3 py-2',
                    blockVisual(block.type).borderClass,
                  )}
                >
                  <p className="text-foreground text-sm font-medium">{block.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {s.blockTypes[block.type]} ·{' '}
                    {minutesLabel(block.estimatedMinutes, s.minutesShort)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        <Link href="/program" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {s.todayGoToPlan}
        </Link>
      </CardContent>
    </Card>
  )
}
