import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import type { DailyActivityPoint } from '@/lib/data/dashboard'
import { WeeklyChart } from './weekly-chart'
import { dashboardStrings } from './strings'
import { fill } from '@/lib/i18n'

/**
 * Haftalık çalışma grafiği kutusu (sunucu bileşeni).
 *
 * Grafiğin kendisi istemcide çizilir (`WeeklyChart`); metinler, toplamlar ve
 * erişilebilir tablo burada, sunucuda üretilir. Böylece sözlük ve tarih
 * biçimlendirme istemci paketine girmez.
 */
export function WeeklyActivityCard({
  points,
  todayKey,
}: {
  points: DailyActivityPoint[]
  todayKey: string
}) {
  const s = dashboardStrings()
  const totalMinutes = points.reduce((sum, point) => sum + point.studyMinutes, 0)
  const hasData = points.some((point) => point.studySeconds > 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 aria-hidden="true" className="text-muted-foreground size-4" />
          {s.weeklyTitle}
        </CardTitle>
        <CardDescription>
          {hasData ? fill(s.weeklyTotal, { minutes: totalMinutes }) : s.weeklySubtitle}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {hasData ? null : (
          <p className="text-muted-foreground text-sm">
            {s.weeklyEmpty} {s.weeklyEmptyHint}
          </p>
        )}

        <WeeklyChart
          points={points.map((point) => ({
            date: point.date,
            shortLabel: point.shortLabel,
            studyMinutes: point.studyMinutes,
          }))}
          todayKey={todayKey}
        />

        {/* Grafiğin metin karşılığı: görsel olarak gizli, ekran okuyucuya açık.
            `hidden` DEĞİL — hidden olsaydı erişilebilirlik ağacından da düşerdi. */}
        <table className="sr-only">
          <caption>{s.weeklyTableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{s.weeklyDay}</th>
              <th scope="col">{s.weeklyMinutes}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date}>
                <th scope="row">{point.longLabel}</th>
                <td>
                  {point.studyMinutes} {s.minutesShort}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
