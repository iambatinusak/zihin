import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { EmptyState } from '@/components/common/empty-state'
import { MasteryBadge } from '@/components/common/mastery-badge'
import { fill } from '@/lib/i18n'
import type { ParentWeakTopic } from '@/lib/data/parent'
import { parentStrings } from './strings'

/**
 * Zayıf konular — öğrencinin gördüğü yetkinlik verisinin SALT OKUNUR hâli.
 *
 * Öğrenci ekranında her satır konuya, videoya ya da hızlı teste bağlanır;
 * burada bilerek düz metindir. Veli bir konuyu "açamaz" (spec §M12).
 */
export function WeakTopicsCard({ topics }: { topics: ParentWeakTopic[] }) {
  const s = parentStrings()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{s.weakTopics.title}</CardTitle>
        <CardDescription>{s.weakTopics.description}</CardDescription>
      </CardHeader>

      <CardContent>
        {topics.length === 0 ? (
          <EmptyState title={s.weakTopics.emptyTitle} description={s.weakTopics.emptyDescription} />
        ) : (
          <ul className="divide-border divide-y">
            {topics.map((topic) => (
              <li
                key={topic.topicId}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">{topic.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {topic.subjectName} ·{' '}
                    {fill(s.weakTopics.attempts, { count: topic.attemptsCount })}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {s.weakTopics.scoreLabel}:{' '}
                    <span className="text-foreground font-medium tabular-nums">
                      {Math.round(topic.mastery)}
                    </span>
                  </span>
                  <MasteryBadge status={topic.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
