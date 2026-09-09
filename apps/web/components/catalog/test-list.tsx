import { ChevronRight, ClipboardList } from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import { StartTestButton } from '@/components/test/start-test-button'
import type { Test } from '@/lib/data'
import { section } from '@/lib/i18n'
import { fill } from '@/lib/i18n'
import type { CatalogStrings } from './strings'
import { ContentEmpty } from './content-empty'
import type { TestStrings } from '@/components/test/strings'

type TestListProps = {
  tests: Array<Test & { questionCount: number }>
  /** Hızlı pratik düğmesinin hedefi. Verilmezse düğme gösterilmez. */
  topicId?: string
}

/**
 * Konunun testleri.
 *
 * Satır bir bağlantı DEĞİL, düğmedir: `/test/[sessionId]` rotasındaki kimlik
 * testin değil oturumun kimliğidir ve oturum `startTest` ile sunucuda açılır
 * (yarım kalan oturum varsa yenisi açılmaz, o sürdürülür).
 */
export function TestList({ tests, topicId }: TestListProps) {
  const s = section<CatalogStrings>('catalog')

  if (tests.length === 0) {
    return (
      <div className="space-y-3">
        <ContentEmpty description={s.emptyTests} />
        <QuickPractice topicId={topicId} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="divide-border border-border divide-y rounded-lg border">
        {tests.map((test) => (
          <li key={test.id}>
            <StartTestButton input={{ testId: test.id }} asRow>
              <ClipboardList aria-hidden="true" className="text-primary size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-medium">{test.title}</span>
                <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{s.testTypes[test.type]}</Badge>
                  <span className="tabular-nums">
                    {fill(s.questionCount, { count: test.questionCount })}
                  </span>
                </span>
              </span>
              <span className="sr-only">{s.solveTest}</span>
              <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
            </StartTestButton>
          </li>
        ))}
      </ul>
      <QuickPractice topicId={topicId} />
    </div>
  )
}

/** 5 soruluk hızlı tekrar; test satırı olmayan konularda da çalışır. */
function QuickPractice({ topicId }: { topicId?: string }) {
  const t = section<TestStrings>('test')
  if (!topicId) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StartTestButton input={{ type: 'quick_practice', topicId }} variant="secondary">
        {t.quickPracticeAction}
      </StartTestButton>
      <span className="text-muted-foreground text-xs">{t.quickPracticeHint}</span>
    </div>
  )
}
