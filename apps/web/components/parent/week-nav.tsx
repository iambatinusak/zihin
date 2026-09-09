import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import { studentHref } from '@/lib/parent/select'
import {
  canGoNextWeek,
  isCurrentWeek,
  nextWeekStart,
  previousWeekStart,
  weekRangeLabel,
} from '@/lib/parent/week'
import { parentStrings } from './strings'

type WeekNavProps = {
  basePath: string
  studentId: string
  weekStart: string
  now: Date
}

/**
 * Hafta gezinmesi. Bağlantı (GET) olarak yazıldı: durum adres çubuğunda durur,
 * paylaşılabilir ve geri tuşu doğru çalışır.
 *
 * "Sonraki hafta" içinde bulunulan haftada kapanır — gelecek bir haftanın
 * özeti her zaman boş olurdu; sunucu tarafı da bunu ayrıca kırpar.
 */
export function WeekNav({ basePath, studentId, weekStart, now }: WeekNavProps) {
  const s = parentStrings()
  const forwardAllowed = canGoNextWeek(weekStart, now)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <p className="text-foreground text-sm font-medium">{weekRangeLabel(weekStart)}</p>
        {isCurrentWeek(weekStart, now) ? (
          <Badge variant="secondary">{s.week.thisWeekBadge}</Badge>
        ) : null}
      </div>

      <nav aria-label={s.week.label} className="flex items-center gap-2">
        <NavLink
          href={studentHref(basePath, studentId, previousWeekStart(weekStart))}
          label={s.week.previous}
          icon={<ChevronLeft aria-hidden="true" className="size-4" />}
        />
        {forwardAllowed ? (
          <NavLink
            href={studentHref(basePath, studentId, nextWeekStart(weekStart))}
            label={s.week.next}
            icon={<ChevronRight aria-hidden="true" className="size-4" />}
            iconLast
          />
        ) : (
          <span className="text-muted-foreground border-border inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm">
            {s.week.next}
            <ChevronRight aria-hidden="true" className="size-4" />
          </span>
        )}
      </nav>
    </div>
  )
}

function NavLink({
  href,
  label,
  icon,
  iconLast = false,
}: {
  href: string
  label: string
  icon: React.ReactNode
  iconLast?: boolean
}) {
  return (
    <Link
      href={href}
      className="border-border hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
    >
      {iconLast ? null : icon}
      {label}
      {iconLast ? icon : null}
    </Link>
  )
}
