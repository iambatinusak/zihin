'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTokenColors } from './use-token-colors'

/**
 * Zaman serisi — haftalık yetkinlik ortalaması.
 *
 * İstemci bileşenidir çünkü Recharts DOM ölçümü yapar; aldığı tek şey düz,
 * serileştirilebilir veridir. Grafiğin KENDİSİ yardımcı teknolojiden gizlenir:
 * erişilebilir karşılığı (özet cümle + tablo) sunucuda çizilir ve bu bileşene
 * hiç bağlı değildir, bkz. `chart-tables.tsx`.
 */

export type TrendPoint = {
  /** Haftanın başlangıcı (YYYY-MM-DD). */
  weekStart: string
  /** Eksende görünen kısa etiket. */
  label: string
  averageMastery: number
  sampleCount: number
}

const TOKENS = ['primary', 'border', 'muted-foreground'] as const

export function MasteryTrendChart({
  points,
  averageLabel,
  weekLabel,
}: {
  points: TrendPoint[]
  averageLabel: string
  weekLabel: string
}) {
  const colors = useTokenColors(TOKENS)

  return (
    <div aria-hidden="true" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={colors['muted-foreground']}
            tick={{ fontSize: 12, fill: colors['muted-foreground'] }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            stroke={colors['muted-foreground']}
            tick={{ fontSize: 12, fill: colors['muted-foreground'] }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: colors.border }}
            formatter={(value: number) => [`${value}`, averageLabel]}
            labelFormatter={(label: string) => `${weekLabel}: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="averageMastery"
            stroke={colors.primary}
            strokeWidth={2}
            dot={{ r: 3, fill: colors.primary, stroke: colors.primary }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
