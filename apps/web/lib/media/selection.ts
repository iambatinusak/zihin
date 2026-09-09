import 'server-only'

import type { DataClient } from '@/lib/data/client'
import {
  getAdminExams,
  getAdminSubjects,
  getAdminTopicsForSubject,
  type ExamOption,
  type SubjectOption,
  type TopicOption,
} from '@/lib/data/admin-media'

/**
 * Yönetim ekranlarının ortak "sınav → ders → konu" seçimi.
 *
 * Dört ekran (video, test, deneme, kart) aynı süzgeci kullanıyor; seçim
 * URL'de tutulduğu için her sayfada aynı okuma ve aynı doğrulama tekrar
 * ederdi. Tek yer burasıdır.
 *
 * Seçim ZİNCİRİ DOĞRULANIR: URL'ye elle yazılmış, seçili derse ait olmayan bir
 * konu kimliği yok sayılır. Aksi hâlde form başka bir dersin konusuna içerik
 * yazabilirdi.
 */

export type CurriculumSelection = {
  exams: ExamOption[]
  subjects: SubjectOption[]
  topics: TopicOption[]
  examId: string | null
  subjectId: string | null
  topicId: string | null
}

export type RawSearchParams = Record<string, string | string[] | undefined>

export function firstParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value
  return first === undefined || first.trim() === '' ? null : first
}

export async function loadCurriculumSelection(
  client: DataClient,
  params: RawSearchParams,
): Promise<CurriculumSelection> {
  const exams = await getAdminExams(client)

  const requestedExam = firstParam(params.sinav)
  const examId = exams.some((exam) => exam.id === requestedExam) ? requestedExam : null

  const subjects = examId ? await getAdminSubjects(client, examId) : []
  const requestedSubject = firstParam(params.ders)
  const subjectId = subjects.some((subject) => subject.id === requestedSubject)
    ? requestedSubject
    : null

  const topics = subjectId ? await getAdminTopicsForSubject(client, subjectId) : []
  const requestedTopic = firstParam(params.konu)
  const topicId = topics.some((topic) => topic.id === requestedTopic) ? requestedTopic : null

  return { exams, subjects, topics, examId, subjectId, topicId }
}
