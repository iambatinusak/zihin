import { Sparkles } from 'lucide-react'
import { PanelCard } from './panel-card'
import { dashboardStrings } from './strings'
import { LevelProgress } from '@/components/gamification/level-progress'
import { gamificationStrings } from '@/components/gamification/strings'

/**
 * Seviye ve XP kutusu.
 *
 * Gösterimin kendisi `components/gamification/level-progress.tsx` içinde:
 * panel ile /rozetler aynı çubuğu ve aynı hesabı paylaşır, iki ekranda iki
 * farklı seviye görünmesin diye.
 */
export function LevelCard({ xp }: { xp: number }) {
  const s = dashboardStrings()
  const g = gamificationStrings()

  return (
    <PanelCard
      title={s.levelTitle}
      icon={<Sparkles aria-hidden="true" className="text-primary size-4" />}
      link={{ href: '/rozetler', label: g.title }}
    >
      <LevelProgress xp={xp} />
    </PanelCard>
  )
}
