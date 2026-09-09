'use client'

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useTokenColors } from './use-token-colors'

/**
 * Ders bazlı radar. Zaman serisiyle aynı kural: renk belirteçten okunur,
 * grafik `aria-hidden`, bilgi sunucuda çizilen özet cümlede ve tabloda.
 */

export type RadarPoint = {
  subjectId: string
  subject: string
  averageMastery: number
  topicCount: number
  measuredTopicCount: number
}

const TOKENS = ['primary', 'border', 'muted-foreground'] as const

export function SubjectRadarChart({
  points,
  averageLabel,
}: {
  points: RadarPoint[]
  averageLabel: string
}) {
  const colors = useTokenColors(TOKENS)

  return (
    <div aria-hidden="true" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={points} outerRadius="72%">
          <PolarGrid stroke={colors.border} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: colors['muted-foreground'] }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: colors['muted-foreground'] }}
            stroke={colors.border}
          />
          <Tooltip formatter={(value: number) => [`${value}`, averageLabel]} />
          <Radar
            dataKey="averageMastery"
            stroke={colors.primary}
            fill={colors.primary}
            fillOpacity={0.25}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
