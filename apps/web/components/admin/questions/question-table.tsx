import Link from 'next/link'
import { Badge } from '@zihin/ui/badge'
import { Button } from '@zihin/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import { fill } from '@/lib/i18n'
import type { QuestionListResult } from '@/lib/data/admin-questions'
import { questionStrings } from './strings'

/**
 * Soru listesi tablosu ve sayfalama.
 *
 * Soru KÖKÜ burada Markdown olarak RENDER EDİLMEZ, kısaltılmış düz metin
 * gösterilir: liste ekranında yüzlerce KaTeX bloğu işlemek hem yavaş hem
 * okunaksız olur. Doğru cevap ve çözüm bu ekrana hiç gelmez (bkz.
 * `lib/data/admin-questions.ts`).
 */

const STEM_PREVIEW_LENGTH = 140

export function QuestionTable({
  result,
  buildPageHref,
}: {
  result: QuestionListResult
  /** Sayfalama bağlantısı; çağıran mevcut filtreleri korur. */
  buildPageHref: (page: number) => string
}) {
  const s = questionStrings()

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm" role="status">
        {fill(s.resultCount, { total: result.total })}
      </p>

      <div className="border-border rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{s.colStem}</TableHead>
              <TableHead className="w-48">{s.colTopic}</TableHead>
              <TableHead className="w-24">{s.colDifficulty}</TableHead>
              <TableHead className="w-28">{s.colStatus}</TableHead>
              <TableHead className="w-40">{s.colUsage}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-md">
                  <Link
                    href={`/admin/sorular/${item.id}`}
                    className="text-foreground hover:text-primary font-medium underline-offset-2 hover:underline"
                  >
                    {truncate(item.stem)}
                  </Link>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {fill(s.optionCount, { count: item.optionCount })}
                  </p>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{item.topicTitle}</span>
                  <p className="text-muted-foreground text-xs">{item.subjectName}</p>
                </TableCell>
                <TableCell>{item.difficulty}</TableCell>
                <TableCell>
                  <Badge variant={item.isPublished ? 'default' : 'secondary'}>
                    {item.isPublished ? s.published : s.draft}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {item.usedInTest ? s.usedInTest : s.notUsed}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {result.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label={s.pageInfo}>
          {result.page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              {s.previousPage}
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(result.page - 1)}>{s.previousPage}</Link>
            </Button>
          )}

          <span className="text-muted-foreground text-sm">
            {fill(s.pageInfo, { page: result.page, pageCount: result.pageCount })}
          </span>

          {result.page >= result.pageCount ? (
            <Button variant="outline" size="sm" disabled>
              {s.nextPage}
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(result.page + 1)}>{s.nextPage}</Link>
            </Button>
          )}
        </nav>
      ) : null}
    </div>
  )
}

/** Markdown işaretlerini sadeleştirip kısaltır; tablo tek satırda okunur kalsın. */
function truncate(stem: string): string {
  const plain = stem
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > STEM_PREVIEW_LENGTH ? `${plain.slice(0, STEM_PREVIEW_LENGTH)}…` : plain
}
