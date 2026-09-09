import { Button } from '@zihin/ui/button'
import { Input } from '@zihin/ui/input'
import { Label } from '@zihin/ui/label'
import Link from 'next/link'
import { MAX_DIFFICULTY, MIN_DIFFICULTY } from '@/lib/admin/questions/options'
import type { TopicOption } from '@/lib/data/admin-questions'
import { SELECT_CLASS } from './select-class'
import { questionStrings } from './strings'

/**
 * Soru listesi filtreleri.
 *
 * Sunucu bileşenidir ve düz bir GET formudur: JavaScript olmadan da çalışır,
 * filtreler adres çubuğunda durur (paylaşılabilir, geri tuşu doğru davranır) ve
 * sayfalama aynı sorgu dizesini taşır. Sınav → ders → konu kutuları birbirini
 * daraltmaz; daraltma istemci durumu gerektirirdi ve bu ekran için gereksiz.
 */

export type QuestionFilterValues = {
  examId: string
  subjectId: string
  topicId: string
  difficulty: string
  published: string
  search: string
}

export function QuestionFilters({
  topics,
  values,
}: {
  topics: TopicOption[]
  values: QuestionFilterValues
}) {
  const s = questionStrings()

  const exams = uniqueBy(
    topics.map((topic) => ({ id: topic.examId, name: topic.examName })),
    (item) => item.id,
  )
  const subjects = uniqueBy(
    topics
      .filter((topic) => values.examId === '' || topic.examId === values.examId)
      .map((topic) => ({ id: topic.subjectId, name: topic.subjectName })),
    (item) => item.id,
  )
  const topicChoices = topics.filter(
    (topic) =>
      (values.examId === '' || topic.examId === values.examId) &&
      (values.subjectId === '' || topic.subjectId === values.subjectId),
  )

  return (
    <form
      method="get"
      action="/admin/sorular"
      className="border-border bg-card space-y-4 rounded-lg border p-4"
      aria-label={s.filterTitle}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 lg:col-span-3">
          <Label htmlFor="filtre-arama">{s.searchLabel}</Label>
          <Input
            id="filtre-arama"
            name="q"
            type="search"
            defaultValue={values.search}
            placeholder={s.searchPlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtre-sinav">{s.examLabel}</Label>
          <select
            id="filtre-sinav"
            name="sinav"
            defaultValue={values.examId}
            className={SELECT_CLASS}
          >
            <option value="">{s.all}</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtre-ders">{s.subjectLabel}</Label>
          <select
            id="filtre-ders"
            name="ders"
            defaultValue={values.subjectId}
            className={SELECT_CLASS}
          >
            <option value="">{s.all}</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtre-konu">{s.topicLabel}</Label>
          <select
            id="filtre-konu"
            name="konu"
            defaultValue={values.topicId}
            className={SELECT_CLASS}
          >
            <option value="">{s.all}</option>
            {topicChoices.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {`${topic.unitName} · ${topic.title}`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtre-zorluk">{s.difficultyLabel}</Label>
          <select
            id="filtre-zorluk"
            name="zorluk"
            defaultValue={values.difficulty}
            className={SELECT_CLASS}
          >
            <option value="">{s.all}</option>
            {difficultyValues().map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtre-durum">{s.publishedLabel}</Label>
          <select
            id="filtre-durum"
            name="durum"
            defaultValue={values.published}
            className={SELECT_CLASS}
          >
            <option value="">{s.all}</option>
            <option value="yayinda">{s.publishedOnly}</option>
            <option value="taslak">{s.draftOnly}</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">
          {s.apply}
        </Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/admin/sorular">{s.reset}</Link>
        </Button>
      </div>
    </form>
  )
}

function difficultyValues(): number[] {
  const values: number[] = []
  for (let value = MIN_DIFFICULTY; value <= MAX_DIFFICULTY; value += 1) values.push(value)
  return values
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const id = key(item)
    if (seen.has(id)) continue
    seen.add(id)
    result.push(item)
  }
  return result
}
