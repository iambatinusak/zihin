import {
  Award,
  CalendarCheck,
  ClipboardCheck,
  Flame,
  Layers,
  Lock,
  PlayCircle,
  Timer,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@zihin/ui/lib/utils'
import { fill } from '@/lib/i18n'
import { longDayLabel, turkeyDayKey } from '@/lib/activity/day'
import type { BadgeBoardItem } from '@/lib/data/gamification'
import { gamificationStrings, type GamificationStrings } from './strings'

/**
 * Rozet ızgarası (ekran §9.14).
 *
 * Kazanılan rozet renkli ve tarihiyle, kazanılmayan kilitli ve KURALIYLA
 * gösterilir. Eşik sayısı bileşene GÖMÜLMEZ: `badges.rule` jsonb'sinden
 * okunur, böylece bir rozetin eşiği veritabanından değiştiğinde ekran da
 * değişir. Renk tek başına anlam taşımaz — her rozette metin vardır.
 */

/**
 * `badges.icon` bir lucide bileşen ADIdır. Dinamik import yerine açık eşleme:
 * veritabanından gelen bir metinle rastgele bileşen çözmek istenmez ve tohum
 * yedi rozeti sabit taşır. Tanınmayan ad nötr bir madalyaya düşer.
 */
const ICONS: Record<string, LucideIcon> = {
  PlayCircle,
  ClipboardCheck,
  Flame,
  CalendarCheck,
  Timer,
  TrendingUp,
  Layers,
}

export function BadgeGrid({ items }: { items: BadgeBoardItem[] }) {
  const s = gamificationStrings()

  return (
    <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <BadgeTile key={item.code} item={item} s={s} />
      ))}
    </ul>
  )
}

function BadgeTile({ item, s }: { item: BadgeBoardItem; s: GamificationStrings }) {
  const Icon = (item.icon ? ICONS[item.icon] : undefined) ?? Award

  return (
    <li
      className={cn(
        'border-border flex gap-3 rounded-lg border p-4',
        item.earned ? 'bg-card' : 'bg-muted/40',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full',
          item.earned ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {item.earned ? (
          <Icon aria-hidden="true" className="size-5" />
        ) : (
          <Lock aria-hidden="true" className="size-5" />
        )}
        <span className="sr-only">
          {item.earned ? s.badgeEarnedIconLabel : s.badgeLockedIconLabel}
        </span>
      </span>

      <div className="min-w-0 space-y-1">
        <p className={cn('font-medium', item.earned ? 'text-foreground' : 'text-muted-foreground')}>
          {item.name}
        </p>
        {item.description ? (
          <p className="text-muted-foreground text-sm">{item.description}</p>
        ) : null}
        <p className={cn('text-sm', item.earned ? 'text-primary' : 'text-muted-foreground')}>
          {item.earned && item.earnedAt !== null
            ? fill(s.badgeEarnedAt, { date: longDayLabel(turkeyDayKey(item.earnedAt)) })
            : `${s.badgeLocked} · ${ruleLabel(item, s)}`}
        </p>
      </div>
    </li>
  )
}

/**
 * Kuralın Türkçe cümlesi. Metrik adı veritabanından gelir; eşik de öyle.
 * Bilinmeyen bir metrik sessizce boş kalmaz, açık bir metin döner.
 */
export function ruleLabel(item: BadgeBoardItem, s: GamificationStrings): string {
  const threshold = item.rule.threshold
  if (threshold === null) return s.ruleUnknown

  const templates: Record<string, string> = {
    videos_completed: s.ruleVideos,
    tests_completed: s.ruleTests,
    current_streak: s.ruleStreak,
    mocks_completed: s.ruleMocks,
    cards_reviewed: s.ruleCards,
    weak_to_strong_count: s.ruleWeakToStrong,
  }

  const template = item.rule.metric === null ? undefined : templates[item.rule.metric]
  return template === undefined ? s.ruleUnknown : fill(template, { threshold })
}
