'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'

/**
 * Haftalık çalışma sütun grafiği.
 *
 * `'use client'` olması zorunlu: Recharts DOM ölçümü yapar. Bu dosya
 * `weekly-chart.tsx` üzerinden TEMBEL yüklenir (bkz. oradaki not). Bileşen
 * küçük tutuldu ve HİÇBİR veri okuma/metin sözlüğü içermiyor — çeviriler ve satırlar
 * sunucudan hazır geliyor, böylece istemci paketine yalnızca grafik giriyor.
 *
 * Erişilebilirlik: grafiğin kendisi `aria-hidden`. Aynı veri, grafiğin yanında
 * görsel olarak gizli ama ekran okuyucuya açık bir TABLO olarak da basılır
 * (`WeeklyChartTable`, sunucu bileşeni). Renk tek başına anlam taşımaz;
 * bugünün sütunu ayrıca "Bugün" etiketiyle işaretlenir.
 */

export type WeeklyChartPoint = {
  date: string
  shortLabel: string
  studyMinutes: number
}

type WeeklyChartProps = {
  points: WeeklyChartPoint[]
  /** Bugünün ISO anahtarı; o sütun vurgulanır. */
  todayKey: string
}

export function WeeklyChartImpl({ points, todayKey }: WeeklyChartProps) {
  return (
    <div aria-hidden="true" className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="shortLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Bar dataKey="studyMinutes" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {points.map((point) => (
              <Cell
                key={point.date}
                fill={
                  point.date === todayKey ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.35)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
