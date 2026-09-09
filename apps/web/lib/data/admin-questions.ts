import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
import { AppError } from '@/lib/errors'
import { readOptions, type OptionKey, type QuestionOption } from '@/lib/admin/questions/options'

/**
 * Yönetim panelinin soru okumaları (spec §M15).
 *
 * İKİ ÖNEMLİ NOKTA:
 *
 *  1. DOĞRU CEVAP. `correct_option` ve `explanation` kolonları `authenticated`
 *     rolünden geri alınmıştır (0011); öğrenciye sızmasınlar diye. Editör bu
 *     kolonları düzenlemek için okumak ZORUNDA, o yüzden `getQuestionForEdit`
 *     çağıranından SERVICE-ROLE istemcisi bekler ve bu ancak rol denetiminden
 *     sonra yapılır. Liste ekranı bu kolonları hiç istemez.
 *  2. DÜZ SORGU. Üretilen tiplerde `Relationships: []` olduğu için iç içe
 *     `select` `never`e çözülür; ilişkiler ayrı sorgularla kurulur.
 */

export type QuestionRow = Tables<'questions'>

/** Filtre kutuları ve içe aktarma için müfredat ağacının düz hâli. */
export type TopicOption = {
  id: string
  slug: string
  title: string
  unitId: string
  unitName: string
  subjectId: string
  subjectName: string
  examId: string
  examName: string
}

/** Liste satırı. `correct_option` ve `explanation` BULUNMAZ. */
export type QuestionListItem = {
  id: string
  stem: string
  topicId: string
  topicTitle: string
  subjectName: string
  difficulty: number
  isPublished: boolean
  optionCount: number
  updatedAt: string
  /** Soru en az bir testte kullanılıyor mu? Silme kararı buna bakar. */
  usedInTest: boolean
}

/** Düzenleyicinin ihtiyaç duyduğu tam kayıt — doğru cevap dâhil. */
export type QuestionDetail = {
  id: string
  topicId: string
  outcomeId: string | null
  stem: string
  options: QuestionOption[]
  correctOption: OptionKey | null
  explanation: string | null
  solutionVideoUrl: string | null
  imageUrl: string | null
  difficulty: number
  expectedSeconds: number | null
  tags: string[]
  isPublished: boolean
  updatedAt: string
}

export type QuestionFilters = {
  examId?: string | null
  subjectId?: string | null
  topicId?: string | null
  difficulty?: number | null
  published?: boolean | null
  /** Soru kökünde tam metin arama (`search_vector` GIN indeksi). */
  search?: string | null
  page: number
  pageSize: number
}

export type QuestionListResult = {
  items: QuestionListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export const DEFAULT_PAGE_SIZE = 25

/**
 * Müfredat ağacını düz bir konu listesine indirger.
 *
 * Dört ayrı sorgu; iç içe select yazılamadığı için ilişkiler bellekte kurulur.
 * Konu sayısı birkaç bin mertebesinde olduğundan bu, filtre kutularını
 * doldurmanın en ucuz yolu.
 */
export async function getTopicOptions(client: DataClient): Promise<TopicOption[]> {
  const [exams, subjects, units, topics] = await Promise.all([
    client.from('exams').select('id, name').is('deleted_at', null),
    client.from('subjects').select('id, exam_id, name, order_index').is('deleted_at', null),
    client.from('units').select('id, subject_id, name, order_index').is('deleted_at', null),
    client.from('topics').select('id, unit_id, title, slug, order_index').is('deleted_at', null),
  ])

  const failed = [exams, subjects, units, topics].find((result) => result.error)
  if (failed) throw new AppError('internal', 'Müfredat yüklenemedi.')

  const examById = new Map((exams.data ?? []).map((exam) => [exam.id, exam]))
  const subjectById = new Map((subjects.data ?? []).map((subject) => [subject.id, subject]))
  const unitById = new Map((units.data ?? []).map((unit) => [unit.id, unit]))

  const result: TopicOption[] = []

  for (const topic of topics.data ?? []) {
    const unit = unitById.get(topic.unit_id)
    if (!unit) continue
    const subject = subjectById.get(unit.subject_id)
    if (!subject) continue
    const exam = examById.get(subject.exam_id)
    if (!exam) continue

    result.push({
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      unitId: unit.id,
      unitName: unit.name,
      subjectId: subject.id,
      subjectName: subject.name,
      examId: exam.id,
      examName: exam.name,
    })
  }

  return result.sort(
    (left, right) =>
      left.examName.localeCompare(right.examName, 'tr') ||
      left.subjectName.localeCompare(right.subjectName, 'tr') ||
      left.unitName.localeCompare(right.unitName, 'tr') ||
      left.title.localeCompare(right.title, 'tr'),
  )
}

/** İçe aktarmanın `topic_slug` sözlüğü: slug → konu kimliği. */
export function topicSlugMap(topics: readonly TopicOption[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const topic of topics) map[topic.slug] = topic.id
  return map
}

/**
 * Filtrelenmiş, sayfalanmış soru listesi.
 *
 * Sınav/ders filtresi konu kimliklerine indirgenir: `questions` yalnızca
 * `topic_id` taşır ve düz sorguyla üst seviyeye çıkılamaz. Filtre hiçbir konuyla
 * eşleşmiyorsa sorgu HİÇ atılmaz — boş `in()` listesi PostgREST'te sözdizimi
 * hatasıdır.
 */
export async function listQuestions(
  client: DataClient,
  filters: QuestionFilters,
  topics: readonly TopicOption[],
): Promise<QuestionListResult> {
  const page = Math.max(1, Math.trunc(filters.page))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize)))
  const empty: QuestionListResult = { items: [], total: 0, page, pageSize, pageCount: 0 }

  const scope = topicScope(topics, filters)
  if (scope !== null && scope.length === 0) return empty

  let query = client
    .from('questions')
    .select('id, stem, topic_id, options, difficulty, is_published, updated_at', { count: 'exact' })
    .is('deleted_at', null)

  if (scope !== null) query = query.in('topic_id', scope)
  if (filters.difficulty != null) query = query.eq('difficulty', filters.difficulty)
  if (filters.published != null) query = query.eq('is_published', filters.published)

  const search = (filters.search ?? '').trim()
  if (search !== '') {
    // `search_vector` `simple` konfigürasyonuyla üretiliyor (0004); aramanın da
    // aynı konfigürasyonu kullanması şart, yoksa hiçbir şey eşleşmez.
    query = query.textSearch('search_vector', search, { type: 'websearch', config: 'simple' })
  }

  const from = (page - 1) * pageSize
  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw new AppError('internal', 'Sorular yüklenemedi.')

  const rows = data ?? []
  const usedIds = await getQuestionsUsedInTests(
    client,
    rows.map((row) => row.id),
  )
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))

  return {
    items: rows.map((row) => {
      const topic = topicById.get(row.topic_id)
      return {
        id: row.id,
        stem: row.stem,
        topicId: row.topic_id,
        topicTitle: topic?.title ?? 'Bilinmeyen konu',
        subjectName: topic?.subjectName ?? '—',
        difficulty: row.difficulty,
        isPublished: row.is_published,
        optionCount: readOptions(row.options).length,
        updatedAt: row.updated_at,
        usedInTest: usedIds.has(row.id),
      }
    }),
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  }
}

/** Filtrelerden konu kimliği kümesi; filtre yoksa `null` (tümü). */
function topicScope(
  topics: readonly TopicOption[],
  filters: Pick<QuestionFilters, 'examId' | 'subjectId' | 'topicId'>,
): string[] | null {
  if (filters.topicId) return [filters.topicId]
  if (filters.subjectId) {
    return topics.filter((topic) => topic.subjectId === filters.subjectId).map((topic) => topic.id)
  }
  if (filters.examId) {
    return topics.filter((topic) => topic.examId === filters.examId).map((topic) => topic.id)
  }
  return null
}

/** Verilen sorulardan hangileri bir testte kullanılıyor. */
export async function getQuestionsUsedInTests(
  client: DataClient,
  questionIds: readonly string[],
): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set()

  const { data, error } = await client
    .from('test_questions')
    .select('question_id')
    .in('question_id', [...questionIds])

  if (error) throw new AppError('internal', 'Soruların test kullanımı okunamadı.')
  return new Set((data ?? []).map((row) => row.question_id))
}

/**
 * Düzenleme için tek soru — DOĞRU CEVAP DÂHİL.
 *
 * `client` SERVICE-ROLE istemcisi olmalıdır (`correct_option` ve `explanation`
 * `authenticated` rolünden geri alınmıştır) ve çağıran, ÖNCE
 * `assertRole(['editor','admin'])` yapmış olmalıdır. Bu fonksiyonun döndürdüğü
 * hiçbir alan öğrenciye giden bir yüzeye verilmez.
 */
export async function getQuestionForEdit(
  client: DataClient,
  questionId: string,
): Promise<QuestionDetail> {
  const { data, error } = await client
    .from('questions')
    .select(
      'id, topic_id, outcome_id, stem, options, correct_option, explanation, solution_video_url, image_url, difficulty, expected_seconds, tags, is_published, updated_at',
    )
    .eq('id', questionId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Soru yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız soru bulunamadı.')

  const options = readOptions(data.options)
  const correct = options.find((option) => option.key === data.correct_option)

  return {
    id: data.id,
    topicId: data.topic_id,
    outcomeId: data.outcome_id,
    stem: data.stem,
    options,
    correctOption: correct?.key ?? null,
    explanation: data.explanation,
    solutionVideoUrl: data.solution_video_url,
    imageUrl: data.image_url,
    difficulty: data.difficulty,
    expectedSeconds: data.expected_seconds,
    tags: data.tags ?? [],
    isPublished: data.is_published,
    updatedAt: data.updated_at,
  }
}

export type OutcomeOption = { id: string; code: string; description: string }

/** Bir konunun kazanımları; düzenleyicideki `outcome_id` kutusunu doldurur. */
export async function getOutcomesForTopic(
  client: DataClient,
  topicId: string,
): Promise<OutcomeOption[]> {
  const { data, error } = await client
    .from('outcomes')
    .select('id, code, description')
    .eq('topic_id', topicId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Kazanımlar yüklenemedi.')
  return data ?? []
}
