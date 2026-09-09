import { levelForXp } from '@zihin/core'
import { Progress } from '@zihin/ui/progress'
import { cn } from '@zihin/ui/lib/utils'
import { fill } from '@/lib/i18n'
import { gamificationStrings } from './strings'

/**
 * Seviye + XP göstergesi. Panel kutusu da (`components/dashboard/level-card`)
 * rozet sayfası da bunu kullanır; ilerleme çubuğunun iki ekranda iki farklı
 * hesapla çizilmesi kaçınıldı.
 *
 * Seviye `profiles.level` kolonundan DEĞİL, core'daki `levelForXp`'ten
 * türetilir: kolon denormalize bir kopyadır ve XP yazımıyla arasında gecikme
 * olabilir; tek doğru kaynak XP toplamıdır.
 */
export function LevelProgress({
  xp,
  className,
  showTotals = true,
}: {
  xp: number
  className?: string
  /** false ise yalnızca seviye ve çubuk çizilir (dar kutular için). */
  showTotals?: boolean
}) {
  const s = gamificationStrings()
  const safeXp = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0
  const info = levelForXp(safeXp)

  const percent = Math.round(info.progress * 100)
  const remaining = info.nextLevelXp === null ? null : info.nextLevelXp - safeXp
  const intoLevel = safeXp - info.currentLevelXp

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-foreground text-2xl font-semibold tabular-nums">
          {fill(s.levelLabel, { level: info.level })}
        </p>
        <p className="text-muted-foreground text-sm tabular-nums">
          {fill(s.xpTotal, { xp: safeXp })}
        </p>
      </div>

      <Progress
        value={percent}
        aria-label={s.levelTitle}
        // Yüzde tek başına anlam taşımasın: ekran okuyucu kalan XP'yi de duysun.
        aria-valuetext={remaining === null ? s.levelMax : fill(s.xpToNext, { xp: remaining })}
      />

      {showTotals ? (
        <p className="text-muted-foreground flex flex-wrap gap-x-2 text-sm">
          <span>{fill(s.xpIntoLevel, { xp: intoLevel })}</span>
          <span aria-hidden="true">·</span>
          <span>{remaining === null ? s.levelMax : fill(s.xpToNext, { xp: remaining })}</span>
        </p>
      ) : null}
    </div>
  )
}
