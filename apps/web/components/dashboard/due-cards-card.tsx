import { Layers } from 'lucide-react'
import { BigNumber, PanelCard, PanelHint } from './panel-card'
import { dashboardStrings } from './strings'

/** Tekrar zamanı gelen hafıza kartı sayısı; kart kuyruğuna götürür. */
export function DueCardsCard({ dueCount }: { dueCount: number }) {
  const s = dashboardStrings()
  const count = Number.isFinite(dueCount) && dueCount > 0 ? Math.floor(dueCount) : 0

  return (
    <PanelCard
      title={s.cardsTitle}
      icon={<Layers aria-hidden="true" className="size-4" />}
      link={{ href: '/kartlar', label: s.goCards }}
    >
      <BigNumber value={count} />
      <PanelHint>{count > 0 ? s.cardsDue : s.cardsEmpty}</PanelHint>
    </PanelCard>
  )
}
