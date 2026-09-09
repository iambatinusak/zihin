import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
import { AppError } from '@/lib/errors'

/**
 * Müfredat okumaları. Uygulamanın başka hiçbir yerinde `.from('topics')` gibi
 * doğrudan sorgu yazılmaz; testler bu katmana sahte istemci geçirerek çalışır.
 */

type Client = DataClient

export type Subject = Tables<'subjects'>
export type Unit = Tables<'units'>
export type Topic = Tables<'topics'>
export type Exam = Tables<'exams'>

/** Konularıyla birlikte tek bir ünite. */
export type UnitWithTopics = Unit & { topics: Topic[] }

/** Üniteleri ve konularıyla birlikte tek bir ders. */
export type SubjectWithUnits = Subject & { units: UnitWithTopics[] }

/** Sınavın tüm müfredat ağacı: ders → ünite → konu. */
export type ExamTree = Exam & { subjects: SubjectWithUnits[] }

/**
 * Bir sınavın ders listesini sıra numarasına göre döner.
 * Silinmiş (soft-deleted) dersler dışarıda kalır.
 */
export async function getSubjects(client: Client, examId: string): Promise<Subject[]> {
  const { data, error } = await client
    .from('subjects')
    .select('*')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Dersler yüklenemedi.')
  return data ?? []
}

/**
 * Bir dersin ünitelerini sıra numarasına göre döner.
 */
export async function getUnits(client: Client, subjectId: string): Promise<Unit[]> {
  const { data, error } = await client
    .from('units')
    .select('*')
    .eq('subject_id', subjectId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Üniteler yüklenemedi.')
  return data ?? []
}

/**
 * Bir ünitenin konularını sıra numarasına göre döner.
 */
export async function getTopicsForUnit(client: Client, unitId: string): Promise<Topic[]> {
  const { data, error } = await client
    .from('topics')
    .select('*')
    .eq('unit_id', unitId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Konular yüklenemedi.')
  return data ?? []
}

/**
 * Slug'ı verilen tek konuyu döner. Konu yoksa `not_found` hatası fırlatır.
 */
export async function getTopicBySlug(client: Client, slug: string): Promise<Topic> {
  const { data, error } = await client
    .from('topics')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Konu yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız konu bulunamadı.')
  return data
}

/**
 * Bir sınavın tüm müfredat ağacını (ders → ünite → konu) tek seferde döner.
 * Sınav yoksa `not_found` hatası fırlatır.
 *
 * Ağaç iç içe tek sorgu yerine üç düz sorgudan kurulur: hem üretilen tiplerle
 * birebir uyuşur, hem de testte sahtelemesi kolaydır.
 */
export async function getExamTree(client: Client, examId: string): Promise<ExamTree> {
  const { data: exam, error } = await client
    .from('exams')
    .select('*')
    .eq('id', examId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Sınav yüklenemedi.')
  if (!exam) throw new AppError('not_found', 'Aradığınız sınav bulunamadı.')

  const subjects = await getSubjects(client, examId)
  if (subjects.length === 0) return { ...exam, subjects: [] }

  const { data: unitRows, error: unitError } = await client
    .from('units')
    .select('*')
    .in(
      'subject_id',
      subjects.map((subject) => subject.id),
    )
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (unitError) throw new AppError('internal', 'Üniteler yüklenemedi.')
  const units = unitRows ?? []

  const topics = await topicsForUnitIds(
    client,
    units.map((unit) => unit.id),
  )

  const topicsByUnit = groupBy(topics, (topic) => topic.unit_id)
  const unitsBySubject = groupBy(units, (unit) => unit.subject_id)

  return {
    ...exam,
    subjects: subjects.map((subject) => ({
      ...subject,
      units: (unitsBySubject.get(subject.id) ?? []).map((unit) => ({
        ...unit,
        topics: topicsByUnit.get(unit.id) ?? [],
      })),
    })),
  }
}

async function topicsForUnitIds(client: Client, unitIds: string[]): Promise<Topic[]> {
  if (unitIds.length === 0) return []

  const { data, error } = await client
    .from('topics')
    .select('*')
    .in('unit_id', unitIds)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Konular yüklenemedi.')
  return data ?? []
}

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    const bucket = map.get(key(row))
    if (bucket) bucket.push(row)
    else map.set(key(row), [row])
  }
  return map
}

/**
 * Aktif (yayında ve silinmemiş) sınavları sıra numarasına göre döner.
 * Onboarding sihirbazı hedef sınav listesini buradan okur; liste veritabanından
 * gelir, koda gömülmez — yeni bir sınav eklendiğinde arayüz kendiliğinden görür.
 */
export async function getActiveExams(client: Client): Promise<Exam[]> {
  const { data, error } = await client
    .from('exams')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Sınavlar yüklenemedi.')
  return data ?? []
}

/* ------------------------------------------------------------------------- *
 * Müfredat tarayıcısı (Faz 2 / M2) okumaları.
 * Yukarıdaki fonksiyonlar korunur; buradakiler yalnızca eklenmiştir.
 * ------------------------------------------------------------------------- */

export type Video = Tables<'videos'>
export type Test = Tables<'tests'>
export type TopicMastery = Tables<'topic_mastery'>

/** Ders kartında gösterilen özet: ünite/konu sayısı ve öğrenilmiş konu oranı. */
export type SubjectOverview = Subject & {
  unitCount: number
  topicCount: number
  learnedCount: number
  progressPercent: number
}

/** Ünite akordiyonunun tek satırı: konu + kullanıcının yetkinliği + kilit durumu. */
export type TopicListItem = Topic & {
  mastery: TopicMastery | null
  hasContent: boolean
  hasFreePreview: boolean
}

export type UnitWithTopicItems = Unit & { topics: TopicListItem[] }

/** Konu sayfasının tüm verisi. */
export type TopicDetail = {
  topic: Topic
  unit: Unit
  subject: Subject
  videos: Video[]
  tests: Array<Test & { questionCount: number }>
  flashcardCount: number
  mastery: TopicMastery | null
}

/**
 * Kullanıcının şu an aktif bir aboneliği var mı?
 * Kilit rozetini göstermek için gerekir; gerçek erişim kararını RLS ve
 * `public.has_active_subscription()` verir, burası yalnızca arayüz içindir.
 */
export async function hasActiveSubscription(client: Client, userId: string): Promise<boolean> {
  const nowIso = new Date().toISOString()

  const { data, error } = await client
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
    .limit(1)

  // Abonelik okunamazsa kullanıcıyı hata ekranına düşürmeyiz; en kısıtlı
  // varsayımla (abonelik yok) devam ederiz.
  if (error) return false
  return (data ?? []).length > 0
}

/**
 * Slug değeri verilen dersi döner. Ders başka bir sınava aitse de bulunamamış
 * sayılır; böylece öğrenci kendi sınavı dışındaki bir dersin sayfasına giremez.
 */
export async function getSubjectBySlug(
  client: Client,
  examId: string,
  slug: string,
): Promise<Subject> {
  const { data, error } = await client
    .from('subjects')
    .select('*')
    .eq('exam_id', examId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Ders yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız ders bulunamadı.')
  return data
}

/** Slug değeri verilen üniteyi, dersine bağlı olarak döner. */
export async function getUnitBySlug(
  client: Client,
  subjectId: string,
  slug: string,
): Promise<Unit> {
  const { data, error } = await client
    .from('units')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Ünite yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız ünite bulunamadı.')
  return data
}

/**
 * /dersler sayfasının verisi: sınavın dersleri + ünite/konu sayıları +
 * kullanıcının öğrenilmiş konu oranı.
 *
 * Dört düz sorgu: dersler, üniteler, konular, yetkinlik satırları. İç içe
 * select kullanılmaz (üretilen tipler ilişki taşımıyor).
 */
export async function getSubjectOverviews(
  client: Client,
  examId: string,
  userId: string,
): Promise<SubjectOverview[]> {
  const subjects = await getSubjects(client, examId)
  if (subjects.length === 0) return []

  const { data: unitRows, error: unitError } = await client
    .from('units')
    .select('id, subject_id')
    .in(
      'subject_id',
      subjects.map((subject) => subject.id),
    )
    .is('deleted_at', null)

  if (unitError) throw new AppError('internal', 'Üniteler yüklenemedi.')
  const units = unitRows ?? []

  const unitIds = units.map((unit) => unit.id)
  const subjectByUnit = new Map(units.map((unit) => [unit.id, unit.subject_id]))

  let topics: Array<{ id: string; unit_id: string }> = []
  if (unitIds.length > 0) {
    const { data: topicRows, error: topicError } = await client
      .from('topics')
      .select('id, unit_id')
      .in('unit_id', unitIds)
      .is('deleted_at', null)

    if (topicError) throw new AppError('internal', 'Konular yüklenemedi.')
    topics = topicRows ?? []
  }

  const masteryByTopic = await masteryForTopicIds(
    client,
    userId,
    topics.map((topic) => topic.id),
  )

  const unitCounts = new Map<string, number>()
  for (const unit of units) {
    unitCounts.set(unit.subject_id, (unitCounts.get(unit.subject_id) ?? 0) + 1)
  }

  const topicCounts = new Map<string, number>()
  const learnedCounts = new Map<string, number>()
  for (const topic of topics) {
    const subjectId = subjectByUnit.get(topic.unit_id)
    if (!subjectId) continue
    topicCounts.set(subjectId, (topicCounts.get(subjectId) ?? 0) + 1)

    const status = masteryByTopic.get(topic.id)?.status
    if (status === 'medium' || status === 'strong') {
      learnedCounts.set(subjectId, (learnedCounts.get(subjectId) ?? 0) + 1)
    }
  }

  return subjects.map((subject) => {
    const topicCount = topicCounts.get(subject.id) ?? 0
    const learnedCount = learnedCounts.get(subject.id) ?? 0
    return {
      ...subject,
      unitCount: unitCounts.get(subject.id) ?? 0,
      topicCount,
      learnedCount,
      progressPercent: topicCount === 0 ? 0 : Math.round((learnedCount / topicCount) * 100),
    }
  })
}

/**
 * /dersler/[subject] sayfasının verisi: dersin üniteleri, her ünitenin
 * konuları, konuların yetkinliği ve içerik/önizleme durumu.
 */
export async function getUnitsWithTopicItems(
  client: Client,
  subjectId: string,
  userId: string,
): Promise<UnitWithTopicItems[]> {
  const units = await getUnits(client, subjectId)
  if (units.length === 0) return []

  const topics = await topicsForUnitIds(
    client,
    units.map((unit) => unit.id),
  )
  const topicIds = topics.map((topic) => topic.id)

  const masteryByTopic = await masteryForTopicIds(client, userId, topicIds)

  // Kilit rozeti için konu başına yalnızca "yayımlanmış video var mı" ve
  // "ücretsiz önizleme var mı" bilgisi gerekir; videoların kendisi gerekmez.
  const contentTopics = new Set<string>()
  const previewTopics = new Set<string>()

  if (topicIds.length > 0) {
    const { data: videoRows, error: videoError } = await client
      .from('videos')
      .select('topic_id, is_free_preview')
      .in('topic_id', topicIds)
      .eq('is_published', true)
      .is('deleted_at', null)

    if (videoError) throw new AppError('internal', 'Konu içerikleri yüklenemedi.')

    for (const video of videoRows ?? []) {
      contentTopics.add(video.topic_id)
      if (video.is_free_preview) previewTopics.add(video.topic_id)
    }
  }

  const topicsByUnit = groupBy(topics, (topic) => topic.unit_id)

  return units.map((unit) => ({
    ...unit,
    topics: (topicsByUnit.get(unit.id) ?? []).map((topic) => ({
      ...topic,
      mastery: masteryByTopic.get(topic.id) ?? null,
      hasContent: contentTopics.has(topic.id),
      hasFreePreview: previewTopics.has(topic.id),
    })),
  }))
}

/**
 * Konu sayfasının verisi. Konu, ünitesi ve dersiyle birlikte; videolar,
 * testler (soru sayılarıyla), hafıza kartı sayısı ve kullanıcının yetkinliği.
 *
 * Sorular yalnızca `questions_public` görünümünden okunur — `questions` tablosunun
 * cevap kolonları `authenticated` rolünden geri alınmıştır, doğrudan select hata verir.
 */
export async function getTopicDetail(
  client: Client,
  input: {
    examId: string
    subjectSlug: string
    unitSlug: string
    topicSlug: string
    userId: string
  },
): Promise<TopicDetail> {
  const subject = await getSubjectBySlug(client, input.examId, input.subjectSlug)
  const unit = await getUnitBySlug(client, subject.id, input.unitSlug)

  const { data: topic, error: topicError } = await client
    .from('topics')
    .select('*')
    .eq('unit_id', unit.id)
    .eq('slug', input.topicSlug)
    .is('deleted_at', null)
    .maybeSingle()

  if (topicError) throw new AppError('internal', 'Konu yüklenemedi.')
  if (!topic) throw new AppError('not_found', 'Aradığınız konu bulunamadı.')

  const [videos, tests, flashcardCount, masteryByTopic] = await Promise.all([
    videosForTopic(client, topic.id),
    testsForTopic(client, topic.id),
    flashcardCountForTopic(client, topic.id),
    masteryForTopicIds(client, input.userId, [topic.id]),
  ])

  return {
    topic,
    unit,
    subject,
    videos,
    tests,
    flashcardCount,
    mastery: masteryByTopic.get(topic.id) ?? null,
  }
}

async function videosForTopic(client: Client, topicId: string): Promise<Video[]> {
  const { data, error } = await client
    .from('videos')
    .select('*')
    .eq('topic_id', topicId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Videolar yüklenemedi.')
  return data ?? []
}

/** Konunun yayımlanmış testleri, her birinin yayımlanmış soru sayısıyla. */
async function testsForTopic(
  client: Client,
  topicId: string,
): Promise<Array<Test & { questionCount: number }>> {
  const { data, error } = await client
    .from('tests')
    .select('*')
    .eq('topic_id', topicId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new AppError('internal', 'Testler yüklenemedi.')
  const tests = data ?? []
  if (tests.length === 0) return []

  const { data: linkRows, error: linkError } = await client
    .from('test_questions')
    .select('test_id, question_id')
    .in(
      'test_id',
      tests.map((test) => test.id),
    )

  if (linkError) throw new AppError('internal', 'Test soruları yüklenemedi.')
  const links = linkRows ?? []
  if (links.length === 0) return tests.map((test) => ({ ...test, questionCount: 0 }))

  // Sayım cevap kolonları görünmeyen `questions_public` üzerinden doğrulanır;
  // böylece yayımdan kaldırılmış sorular sayıya girmez.
  const { data: questionRows, error: questionError } = await client
    .from('questions_public')
    .select('id')
    .in(
      'id',
      links.map((link) => link.question_id),
    )
    .eq('is_published', true)

  if (questionError) throw new AppError('internal', 'Test soruları yüklenemedi.')

  const visible = new Set((questionRows ?? []).flatMap((row) => (row.id ? [row.id] : [])))
  const counts = new Map<string, number>()
  for (const link of links) {
    if (!visible.has(link.question_id)) continue
    counts.set(link.test_id, (counts.get(link.test_id) ?? 0) + 1)
  }

  return tests.map((test) => ({ ...test, questionCount: counts.get(test.id) ?? 0 }))
}

async function flashcardCountForTopic(client: Client, topicId: string): Promise<number> {
  const { count, error } = await client
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .eq('is_published', true)
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Hafıza kartları yüklenemedi.')
  return count ?? 0
}

/**
 * Kullanıcının verilen konulardaki yetkinlik satırları.
 * RLS zaten kullanıcıyı kapsıyor, ama filtre açıkça yazılır: sorgu okunduğunda
 * hangi kullanıcının verisi olduğu görünsün.
 */
async function masteryForTopicIds(
  client: Client,
  userId: string,
  topicIds: string[],
): Promise<Map<string, TopicMastery>> {
  if (topicIds.length === 0) return new Map()

  const { data, error } = await client
    .from('topic_mastery')
    .select('*')
    .eq('user_id', userId)
    .in('topic_id', topicIds)

  if (error) throw new AppError('internal', 'Yetkinlik bilgisi yüklenemedi.')
  return new Map((data ?? []).map((row) => [row.topic_id, row]))
}
