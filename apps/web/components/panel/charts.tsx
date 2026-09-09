'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@zihin/ui/skeleton'
import type { MasteryTrendChart } from './mastery-trend-chart'
import type { SubjectRadarChart } from './subject-radar-chart'

/**
 * Recharts'ı ilk yükten ÇIKARAN sarmalayıcı.
 *
 * Kütüphane ~110 kB ve iki grafik de sayfanın altında duruyor; `next/dynamic`
 * ile ayrı bir parçaya alınır ve ancak grafik ekrana geldiğinde indirilir.
 * (Faz 3'te react-markdown'ın istemciye çekilmesiyle öğrenilen ders,
 * CONVENTIONS'ın Markdown maddesi.)
 *
 * `ssr: false`: grafikler zaten `aria-hidden`, erişilebilir karşılığı
 * sunucudan gelen özet cümle ve gizli tablodur — sunucuda çizilmelerinin
 * hiçbir faydası yok.
 */

const Fallback = () => <Skeleton className="h-64 w-full" />

export const LazyMasteryTrendChart = dynamic(
  () => import('./mastery-trend-chart').then((mod) => mod.MasteryTrendChart),
  { ssr: false, loading: Fallback },
) as typeof MasteryTrendChart

export const LazySubjectRadarChart = dynamic(
  () => import('./subject-radar-chart').then((mod) => mod.SubjectRadarChart),
  { ssr: false, loading: Fallback },
) as typeof SubjectRadarChart
