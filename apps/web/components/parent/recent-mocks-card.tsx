import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { EmptyState } from '@/components/common/empty-state'
import { longDayLabel, turkeyDayKey } from '@/lib/activity/day'
import { fill } from '@/lib/i18n'
import type { ParentMockResult } from '@/lib/data/parent'
import { parentStrings } from './strings'

/**
 * Son denemeler — ders bazlı ve toplam net.
 *
 * Sonuç ekranına bağlantı YOKTUR: `/sonuc/<id>` sayfası soruların çözümünü ve
 * açıklamasını gösterir, veli içeriği göremez (spec §M12). Veliye gereken
 * bilgi zaten bu tabloda.
 */
export function RecentMocksCard({ results }: { results: ParentMockResult[] }) {
  const s = parentStrings()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{s.mocks.title}</CardTitle>
        <CardDescription>{s.mocks.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {results.length === 0 ? (
          <EmptyState title={s.mocks.emptyTitle} description={s.mocks.emptyDescription} />
        ) : (
          results.map((result) => <MockResult key={result.sessionId} result={result} />)
        )}
      </CardContent>
    </Card>
  )
}

function MockResult({ result }: { result: ParentMockResult }) {
  const s = parentStrings()

  return (
    <section className="border-border rounded-lg border p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-foreground truncate text-sm font-medium">
            {result.title || s.mocks.title}
          </h3>
          <p className="text-muted-foreground text-xs">
            {longDayLabel(turkeyDayKey(result.finishedAt))} ·{' '}
            {result.percentile === null
              ? s.mocks.percentileEmpty
              : fill(s.mocks.percentile, { percent: Math.round(result.percentile) })}
          </p>
        </div>

        <p className="flex items-baseline gap-1.5">
          {/* Net kesirlidir (yanlış katsayısı 1/4 ya da 1/3); iki hane yeter. */}
          <span className="text-foreground text-2xl font-semibold tabular-nums">
            {result.net.toFixed(2)}
          </span>
          <span className="text-muted-foreground text-sm">{s.mocks.net}</span>
        </p>
      </header>

      <p className="text-muted-foreground mt-1 text-xs">
        {result.correct} {s.mocks.correct} · {result.wrong} {s.mocks.wrong} · {result.blank}{' '}
        {s.mocks.blank}
      </p>

      {result.sections.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-muted-foreground mb-2 text-left text-xs">
              {s.mocks.subjectsTitle}
            </caption>
            <thead>
              <tr className="text-muted-foreground text-xs">
                <th scope="col" className="py-1 text-left font-medium">
                  {s.mocks.subjectColumn}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {s.mocks.netColumn}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {s.mocks.correct}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {s.mocks.wrong}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {s.mocks.blank}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {result.sections.map((sectionRow) => (
                <tr key={sectionRow.subjectId}>
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {sectionRow.subjectName}
                  </th>
                  <td className="py-1.5 text-right font-medium tabular-nums">
                    {sectionRow.net.toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{sectionRow.correct}</td>
                  <td className="py-1.5 text-right tabular-nums">{sectionRow.wrong}</td>
                  <td className="py-1.5 text-right tabular-nums">{sectionRow.blank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
