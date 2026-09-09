import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@zihin/ui/table'
import type { MasteryStatus } from '@zihin/core'
import type { TopicBreakdown } from '@/lib/test-engine/session'
import type { TopicLabelRow } from '@/lib/data/topic-labels'
import { MasteryBadge } from '@/components/common/mastery-badge'
import { section } from '@/lib/i18n'
import type { TestStrings } from './strings'
import { groupBySubject } from './result-state'

/**
 * Ders ve konu kırılımı (spec §9.9).
 *
 * Ders satırında NET GÖSTERİLMEZ: net katsayıya bağlı bir orandır ve konu
 * netlerinin toplamı ders netini vermez; ders düzeyinde doğru/yanlış/boş
 * gösterilir. Net yalnızca konu satırında ve genel özette yer alır.
 */
export function ResultBreakdown({
  byTopic,
  labels,
  mastery,
}: {
  byTopic: TopicBreakdown[]
  labels: Map<string, TopicLabelRow>
  /** Konu → bu gönderimden SONRAKİ yetkinlik. Kaydı olmayan konu haritada yoktur. */
  mastery: Map<string, { mastery: number; status: MasteryStatus; attemptsCount: number }>
}) {
  const s = section<TestStrings>('test')
  if (byTopic.length === 0) return null

  const subjects = groupBySubject(byTopic, labels, s.result.otherSubject)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-foreground text-base font-semibold">{s.result.bySubject}</h2>
        <div className="border-border overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.result.subjectColumn}</TableHead>
                <TableHead className="text-right">{s.result.totalColumn}</TableHead>
                <TableHead className="text-right">{s.result.correct}</TableHead>
                <TableHead className="text-right">{s.result.wrong}</TableHead>
                <TableHead className="text-right">{s.result.blank}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.subjectId}>
                  <TableCell className="font-medium">{subject.subjectName}</TableCell>
                  <TableCell className="text-right tabular-nums">{subject.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{subject.correct}</TableCell>
                  <TableCell className="text-right tabular-nums">{subject.wrong}</TableCell>
                  <TableCell className="text-right tabular-nums">{subject.blank}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground text-base font-semibold">{s.result.byTopic}</h2>
        <div className="border-border overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.result.topicColumn}</TableHead>
                <TableHead className="text-right">{s.result.correct}</TableHead>
                <TableHead className="text-right">{s.result.wrong}</TableHead>
                <TableHead className="text-right">{s.result.blank}</TableHead>
                <TableHead className="text-right">{s.result.net}</TableHead>
                <TableHead className="text-right">{s.result.masteryColumn}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTopic.map((topic) => {
                const label = labels.get(topic.topicId)
                const level = mastery.get(topic.topicId)
                return (
                  <TableRow key={topic.topicId}>
                    <TableCell className="font-medium">
                      {label ? (
                        <Link
                          href={`/dersler/${label.subjectSlug}/${label.unitSlug}/${label.topicSlug}`}
                          className="hover:text-primary underline-offset-2 hover:underline"
                        >
                          {label.topicTitle}
                        </Link>
                      ) : (
                        s.result.otherSubject
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{topic.correct}</TableCell>
                    <TableCell className="text-right tabular-nums">{topic.wrong}</TableCell>
                    <TableCell className="text-right tabular-nums">{topic.blank}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {topic.net.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {level ? (
                        <MasteryBadge
                          mastery={level.mastery}
                          attempts={level.attemptsCount}
                          showScore
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {s.result.masteryUnknown}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {/* Yetkinlik `finishTest` içinde, bu sayfa basılmadan ÖNCE yeniden
            hesaplandı (spec §M6); tablodaki rozet o taze satırı gösterir. */}
        <p className="text-muted-foreground text-xs">{s.result.masteryHint}</p>
      </section>
    </div>
  )
}
