'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { Label } from '@zihin/ui/label'
import { t } from '@/lib/i18n/admin-media'
import type { ExamOption, SubjectOption, TopicOption } from '@/lib/data/admin-media'

/**
 * Sınav → ders → konu süzgeci.
 *
 * Seçim URL'de (`?sinav=&ders=&konu=`) tutulur; böylece sayfa sunucuda
 * yeniden çizilir, konu listesi istemciye peşin yüklenmez (1164 konu var) ve
 * editörün elindeki bağlantı paylaşılabilir olur.
 */

export type CurriculumFilterProps = {
  exams: ExamOption[]
  subjects: SubjectOption[]
  topics: TopicOption[]
  examId: string | null
  subjectId: string | null
  topicId: string | null
  /** Konu seçimi olmayan ekranlar (deneme kurucusu) için gizlenir. */
  showTopic?: boolean
}

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px]'

export function CurriculumFilter({
  exams,
  subjects,
  topics,
  examId,
  subjectId,
  topicId,
  showTopic = true,
}: CurriculumFilterProps) {
  const router = useRouter()
  const pathname = usePathname()

  /** Üst seviye değişince alt seçimler düşer; eski konu yeni derse ait değil. */
  function go(next: { exam?: string | null; subject?: string | null; topic?: string | null }) {
    const params = new URLSearchParams()
    if (next.exam) params.set('sinav', next.exam)
    if (next.subject) params.set('ders', next.subject)
    if (next.topic) params.set('konu', next.topic)
    const query = params.toString()
    router.push(query === '' ? pathname : `${pathname}?${query}`)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="filtre-sinav">{t('adminMedia.selectExam')}</Label>
        <select
          id="filtre-sinav"
          className={SELECT_CLASS}
          value={examId ?? ''}
          onChange={(event) => go({ exam: event.target.value || null })}
        >
          <option value="">{t('adminMedia.selectPlaceholder')}</option>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filtre-ders">{t('adminMedia.selectSubject')}</Label>
        <select
          id="filtre-ders"
          className={SELECT_CLASS}
          value={subjectId ?? ''}
          disabled={examId === null}
          onChange={(event) => go({ exam: examId, subject: event.target.value || null })}
        >
          <option value="">{t('adminMedia.selectPlaceholder')}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>

      {showTopic ? (
        <div className="space-y-1.5">
          <Label htmlFor="filtre-konu">{t('adminMedia.selectTopic')}</Label>
          <select
            id="filtre-konu"
            className={SELECT_CLASS}
            value={topicId ?? ''}
            disabled={subjectId === null}
            onChange={(event) =>
              go({ exam: examId, subject: subjectId, topic: event.target.value || null })
            }
          >
            <option value="">{t('adminMedia.selectPlaceholder')}</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )
}
