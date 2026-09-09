'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@zihin/ui/skeleton'

/**
 * Grafiğin yükleme sınırı.
 *
 * Recharts tek başına ~100 kB; panel öğrencinin gördüğü İLK ekran ve o yükü
 * ilk boyamaya bindirmek LCP bütçesini (spec §performans) yer. Bu yüzden asıl
 * çizim `next/dynamic` ile ayrı bir parçaya alınır ve sunucuda basılmaz —
 * grafiğin metin karşılığı (erişilebilir tablo) zaten sunucuda basılıyor,
 * dolayısıyla JavaScript kapalıyken de veri okunabilir kalır.
 *
 * Faz 3'te markdown yığınının istemciye sızması aynı hatanın büyüğüydü;
 * tekrarlanmasın diye grafik en baştan tembel yüklenir.
 */
const WeeklyChartImpl = dynamic(
  () => import('./weekly-chart-impl').then((mod) => mod.WeeklyChartImpl),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full" />,
  },
)

export type WeeklyChartPoint = {
  date: string
  shortLabel: string
  studyMinutes: number
}

export function WeeklyChart(props: { points: WeeklyChartPoint[]; todayKey: string }) {
  return <WeeklyChartImpl {...props} />
}
