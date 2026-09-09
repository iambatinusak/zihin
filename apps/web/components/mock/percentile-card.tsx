import { BarChart3, Info, Lock } from 'lucide-react'
import type { PercentileView } from '@/lib/mock/percentile'
import { formatTopPercent } from '@/lib/mock/percentile'
import { fill, section } from '@/lib/i18n'
import type { MockStrings } from './strings'

/**
 * Yüzdelik dilim kartı (spec §15).
 *
 * ÜÇ HÂL VAR ve üçü de açıkça yazılır:
 *  1. Sıralama henüz açılmadı — canlı pencere sürüyor.
 *  2. Örnek yetersiz (20 katılımcının altında) — "Yeterli veri yok" ve NEDENİ.
 *  3. Hazır — dilim, kaç kişi arasında olduğu ve TAHMİN olduğu belirtilen
 *     sıralama cümlesi.
 *
 * Sıralama cümlesi bilinçli olarak "tahmin" der ve gerçek sınav sıralaması
 * VAAT ETMEZ: buradaki dağılım yalnızca bu denemeyi çözenlerden oluşuyor.
 */
export function PercentileCard({
  view,
  rankingVisible,
}: {
  /** Sıralama kapalıyken null gelir. */
  view: PercentileView | null
  rankingVisible: boolean
}) {
  const s = section<MockStrings>('mock')

  if (!rankingVisible || view === null) {
    return (
      <div className="border-border rounded-lg border p-4">
        <p className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Lock aria-hidden="true" className="text-muted-foreground size-4" />
          {s.result.rankingLocked}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">{s.result.rankingLockedHint}</p>
      </div>
    )
  }

  if (view.status === 'insufficient') {
    return (
      <div className="border-border rounded-lg border p-4">
        <p className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Info aria-hidden="true" className="text-muted-foreground size-4" />
          {s.result.percentileInsufficient}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {fill(s.result.percentileInsufficientHint, {
            required: view.required,
            count: view.sampleSize,
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <BarChart3 aria-hidden="true" className="text-primary size-4" />
        {s.result.percentileTitle}
      </p>
      <p className="text-primary mt-1 text-3xl font-semibold tabular-nums">
        {fill(s.result.percentileValue, { percent: view.percentile })}
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        {fill(s.result.percentileHint, { count: view.sampleSize })}
      </p>
      <p className="text-foreground mt-2 text-sm">
        {fill(s.result.percentileEstimate, { top: formatTopPercent(view.topPercent) })}
      </p>
    </div>
  )
}
