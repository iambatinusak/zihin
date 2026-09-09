import { Flame } from 'lucide-react'
import { BigNumber, PanelCard, PanelHint } from './panel-card'
import { dashboardStrings } from './strings'

/**
 * Seri kutusu. Seri gün sayısı `profiles.current_streak`'ten gelir; hesabı
 * core'daki `updateStreak` yapar ve yazımı `lib/activity/record.ts` üstlenir —
 * burada yalnızca gösterilir.
 */
export function StreakCard({ currentStreak }: { currentStreak: number }) {
  const s = dashboardStrings()
  const days = Number.isFinite(currentStreak) && currentStreak > 0 ? Math.floor(currentStreak) : 0

  return (
    <PanelCard
      title={s.streakTitle}
      icon={
        <Flame
          aria-hidden="true"
          className={days > 0 ? 'text-mastery-medium size-4' : 'size-4 opacity-50'}
        />
      }
    >
      {days > 0 ? (
        <>
          <BigNumber value={days} unit={s.streakDays} />
          <PanelHint>{s.streakHint}</PanelHint>
        </>
      ) : (
        <>
          <BigNumber value={0} unit={s.streakDays} />
          <PanelHint>{s.streakEmpty}</PanelHint>
        </>
      )}
    </PanelCard>
  )
}
