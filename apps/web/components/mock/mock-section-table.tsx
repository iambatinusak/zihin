import type { MockSummary } from '@zihin/core'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import { section } from '@/lib/i18n'
import type { MockStrings } from './strings'

/**
 * Ders bazlı doğru/yanlış/boş ve net tablosu (spec §M10).
 *
 * Sayıların hiçbiri burada hesaplanmaz: `calculateMockSummary` (core) üretir,
 * bu bileşen yalnızca basar. Genel net de bölüm netlerinin toplamıdır ve yine
 * core'dan gelir — burada toplanmaz.
 *
 * Sorusu olmayan bir bölüm (havuz eksikse olur) satır olarak KALIR ve net
 * yerine açıklama gösterir: kaybolan bir ders, bozuk bir ekran hissi verir.
 */
export function MockSectionTable({ summary }: { summary: MockSummary }) {
  const s = section<MockStrings>('mock')

  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-base font-semibold">{s.result.bySection}</h2>
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{s.result.sectionColumn}</TableHead>
              <TableHead className="text-right">{s.result.totalColumn}</TableHead>
              <TableHead className="text-right">{s.result.correct}</TableHead>
              <TableHead className="text-right">{s.result.wrong}</TableHead>
              <TableHead className="text-right">{s.result.blank}</TableHead>
              <TableHead className="text-right">{s.result.net}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.sections.map((entry) => (
              <TableRow key={entry.subjectId}>
                <TableCell className="font-medium">{entry.subjectName}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.total}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.correct}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.wrong}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.blank}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {entry.total === 0 ? (
                    <span className="text-muted-foreground text-xs">{s.result.emptySection}</span>
                  ) : (
                    entry.net.toFixed(2)
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40">
              <TableCell className="font-semibold">{s.result.overall}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {summary.total}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {summary.correct}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {summary.wrong}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {summary.blank}
              </TableCell>
              <TableCell className="text-primary text-right font-semibold tabular-nums">
                {summary.net.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
