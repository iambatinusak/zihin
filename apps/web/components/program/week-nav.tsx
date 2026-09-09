import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import { buttonVariants } from '@zihin/ui/button'
import { addWeeksIso } from '@/lib/plan/week'
import { weekRangeLabel } from './format'
import type { ProgramStrings } from './strings'

/**
 * Hafta gezinme. Bağlantı (`<Link>`), düğme değil: adres çubuğunda hafta
 * görünür, geri tuşu çalışır ve öğrenci belirli bir haftayı paylaşabilir.
 */
export function WeekNav({
  weekStart,
  currentWeekStart,
  strings,
}: {
  weekStart: string
  /** İçinde bulunulan haftanın Pazartesi'si — "Bu hafta" rozetini belirler. */
  currentWeekStart: string
  strings: ProgramStrings
}) {
  const previous = addWeeksIso(weekStart, -1)
  const next = addWeeksIso(weekStart, 1)
  const isCurrent = weekStart === currentWeekStart

  return (
    <nav aria-label={strings.weekOf} className="flex flex-wrap items-center gap-2">
      <Link
        href={`/program?hafta=${previous}`}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {strings.previousWeek}
      </Link>

      <p className="text-foreground min-w-48 text-center text-sm font-medium">
        {weekRangeLabel(weekStart, strings)}
      </p>

      <Link
        href={`/program?hafta=${next}`}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        {strings.nextWeek}
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>

      {isCurrent ? (
        <Badge variant="secondary">{strings.thisWeekBadge}</Badge>
      ) : (
        <Link
          href="/program"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          aria-label={strings.currentWeek}
        >
          {strings.currentWeek}
        </Link>
      )}
    </nav>
  )
}
