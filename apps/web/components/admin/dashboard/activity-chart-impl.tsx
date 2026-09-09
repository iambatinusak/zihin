'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

/**
 * Platform etkinliği çizgi grafiği (izlenen video / çözülen soru).
 *
 * `'use client'` zorunlu: Recharts DOM ölçer. Bileşen veri okumaz ve sözlüğe
 * dokunmaz — satırlar ve etiketler sunucudan hazır gelir, istemci paketine
 * yalnızca çizim girer.
 *
 * Erişilebilirlik: grafik `aria-hidden`; aynı veri yanında bir TABLO olarak
 * da basılır (`ActivityTable`, sunucu bileşeni). Renk tek başına anlam
 * taşımaz, iki seri ayrıca gösterge (legend) ile adlandırılır.
 */

export type ActivityChartPoint = {
  date: string
  label: string
  videos: number
  questions: number
}

export function ActivityChartImpl({
  points,
  videoLabel,
  questionLabel,
}: {
  points: ActivityChartPoint[]
  videoLabel: string
  questionLabel: string
}) {
  return (
    <div aria-hidden="true" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="videos"
            name={videoLabel}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="questions"
            name={questionLabel}
            stroke="hsl(var(--mastery-strong))"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
