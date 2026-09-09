'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@zihin/ui/skeleton'
import type { ActivityChartPoint } from './activity-chart-impl'

/**
 * Grafiğin yükleme sınırı: Recharts tek başına ~100 kB ve yalnızca bu ekranda
 * gerekiyor. `next/dynamic` ile ayrı parçaya alınır, sunucuda basılmaz —
 * metin karşılığı (tablo) zaten sunucuda basıldığı için JavaScript kapalıyken
 * de veri okunabilir kalır.
 */
const ActivityChartImpl = dynamic(
  () => import('./activity-chart-impl').then((module) => module.ActivityChartImpl),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> },
)

export type { ActivityChartPoint }

export function ActivityChart(props: {
  points: ActivityChartPoint[]
  videoLabel: string
  questionLabel: string
}) {
  return <ActivityChartImpl {...props} />
}
