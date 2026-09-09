import { ClipboardCheck } from 'lucide-react'
import type { LastMockResult } from '@/lib/data/dashboard'
import { BigNumber, PanelCard, PanelHint } from './panel-card'
import { dashboardStrings } from './strings'
import { fill } from '@/lib/i18n'

/**
 * Son deneme neti.
 *
 * Denemeler Faz 5'in konusu; burada yalnızca sonuç gösterilir. Veri yokken
 * "yakında" demek yerine ne olacağını anlatan tasarlanmış bir boş durum
 * gösterilir — yeni bir öğrenci bu kutuyu her zaman boş görecek.
 */
export function LastMockCard({ result }: { result: LastMockResult | null }) {
  const s = dashboardStrings()

  if (!result || result.net === null) {
    return (
      <PanelCard
        title={s.mockTitle}
        icon={<ClipboardCheck aria-hidden="true" className="size-4" />}
      >
        <p className="text-foreground text-sm font-medium">{s.mockEmpty}</p>
        <PanelHint>{s.mockEmptyHint}</PanelHint>
      </PanelCard>
    )
  }

  return (
    <PanelCard
      title={s.mockTitle}
      icon={<ClipboardCheck aria-hidden="true" className="size-4" />}
      link={{ href: `/sonuc/${result.sessionId}`, label: result.testTitle || s.mockTitle }}
    >
      {/* Net kesirli olabilir (yanlış katsayısı 1/4); iki haneden fazlası
          anlamsız, bu yüzden sabit iki hane. */}
      <BigNumber value={result.net.toFixed(2)} unit={s.mockNet} />
      <PanelHint>
        {[
          result.percentile === null
            ? null
            : fill(s.mockPercentile, { percent: Math.round(result.percentile) }),
          `${result.correct ?? 0} ${s.mockCorrect}`,
          `${result.wrong ?? 0} ${s.mockWrong}`,
          `${result.blank ?? 0} ${s.mockBlank}`,
        ]
          .filter((part): part is string => part !== null)
          .join(' · ')}
      </PanelHint>
    </PanelCard>
  )
}
