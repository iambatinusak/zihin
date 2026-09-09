import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
import { AppError } from '@/lib/errors'

/**
 * Yönetim paneli — video, test/deneme ve kart ekranlarının okuma katmanı
 * (spec §M15).
 *
 * `lib/data/index.ts` paylaşılan bir dosya olduğu ve bu modül yalnızca
 * yönetim rotalarında kullanıldığı için oradan yeniden dışa aktarılmadı;
 * `@/lib/data/admin-media` ile doğrudan içe aktarılır.
 *
 * ── İKİ ÖNEMLİ NOT ─────────────────────────────────────────────────────────
 * 1. Buradaki okumalar öğrenci tarafından FARKLI: yayımlanmamış (taslak)
 *    içerik de listelenir, çünkü editörün düzenlediği şey tam olarak odur.
 *    Yumuşak silinmiş satırlar (`deleted_at`) her yerde dışarıda bırakılır.
 * 2. `questions` tablosundan ASLA `select('*')` yapılmaz. `correct_option` ve
 *    `explanation` kolonları `authenticated` rolünden geri alınmıştır; yıldız
 *    seçimi RSC istemcisiyle çalışma anında hata verir. Bu modül soruların
 *    yalnızca tanıtıcı kolonlarını okur — cevap hiçbir yönetim listesine
 *    girmez, dolayısıyla bu dosyanın service-role istemcisine ihtiyacı yoktur.
 *    (Soru düzenleyicisi ayrı bir modülün işi.)
 */

type Client = DataClient

export type AdminVideo = Tables<'videos'>
export type AdminFlashcard = Tables<'flashcards'>
export type AdminTest = Tables<'tests'>

// ---------------------------------------------------------------------------
// Müfredat seçicileri
// ---------------------------------------------------------------------------

export type ExamOption = { id: string; name: string; code: string }
export type SubjectOption = { id: string; examId: string; name: string }
export type UnitOption = { id: string; subjectId: string; name: string }
export type TopicOption = { id: string; unitId: string; title: string }

/** Yönetimdeki sınavlar. Pasif sınav da listelenir; editör onu da düzenler. */
export async function getAdminExams(client: Client): Promise<ExamOption[]> {
  const { data, error } = await client
    .from('exams')
    .select('id, name, code')
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Sınavlar yüklenemedi.')
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, code: row.code }))
}

export async function getAdminSubjects(client: Client, examId: string): Promise<SubjectOption[]> {
  const { data, error } = await client
    .from('subjects')
    .select('id, exam_id, name')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Dersler yüklenemedi.')
  return (data ?? []).map((row) => ({ id: row.id, examId: row.exam_id, name: row.name }))
}

export async function getAdminUnits(client: Client, subjectId: string): Promise<UnitOption[]> {
  const { data, error } = await client
    .from('units')
    .select('id, subject_id, name')
    .eq('subject_id', subjectId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Üniteler yüklenemedi.')
  return (data ?? []).map((row) => ({ id: row.id, subjectId: row.subject_id, name: row.name }))
}

/**
 * Bir dersin bütün konuları (ünite sırasıyla).
 * İç içe select yerine iki düz sorgu — üretilen tipler ilişki taşımıyor.
 */
export async function getAdminTopicsForSubject(
  client: Client,
  subjectId: string,
): Promise<TopicOption[]> {
  const units = await getAdminUnits(client, subjectId)
  if (units.length === 0) return []

  const unitOrder = new Map(units.map((unit, index) => [unit.id, index]))

  const { data, error } = await client
    .from('topics')
    .select('id, unit_id, title, order_index')
    .in(
      'unit_id',
      units.map((unit) => unit.id),
    )
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Konular yüklenemedi.')

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      unitId: row.unit_id,
      title: row.title,
      orderIndex: row.order_index,
    }))
    .sort((a, b) => {
      const unitDiff = (unitOrder.get(a.unitId) ?? 0) - (unitOrder.get(b.unitId) ?? 0)
      return unitDiff !== 0 ? unitDiff : a.orderIndex - b.orderIndex
    })
    .map(({ id, unitId, title }) => ({ id, unitId, title }))
}

/** Tek konu; yoksa hata. Yönetim formları konu kimliğini doğrulamak için kullanır. */
export async function getAdminTopic(client: Client, topicId: string): Promise<TopicOption> {
  const { data, error } = await client
    .from('topics')
    .select('id, unit_id, title')
    .eq('id', topicId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Konu yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız konu bulunamadı.')
  return { id: data.id, unitId: data.unit_id, title: data.title }
}

// ---------------------------------------------------------------------------
// Videolar
// ---------------------------------------------------------------------------

/** Bir konunun tüm videoları — TASLAKLAR DÂHİL (öğrenci tarafından farkı budur). */
export async function getAdminVideosForTopic(
  client: Client,
  topicId: string,
): Promise<AdminVideo[]> {
  const { data, error } = await client
    .from('videos')
    .select('*')
    .eq('topic_id', topicId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Videolar yüklenemedi.')
  return data ?? []
}

export async function getAdminVideo(client: Client, videoId: string): Promise<AdminVideo> {
  const { data, error } = await client
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Video yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız video bulunamadı.')
  return data
}

/** Yeni videonun sıra numarası bu değerin bir fazlasıdır. */
export async function getNextVideoOrderIndex(client: Client, topicId: string): Promise<number> {
  const { data, error } = await client
    .from('videos')
    .select('order_index')
    .eq('topic_id', topicId)
    .is('deleted_at', null)
    .order('order_index', { ascending: false })
    .limit(1)

  if (error) throw new AppError('internal', 'Sıra numarası okunamadı.')
  const top = (data ?? [])[0]
  return top ? top.order_index + 1 : 0
}

// ---------------------------------------------------------------------------
// Video durakları (checkpoint)
// ---------------------------------------------------------------------------

export type AdminCheckpoint = {
  id: string
  videoId: string
  timestampSeconds: number
  orderIndex: number
  questionId: string
  /** Sorunun kökü; listede ne olduğu anlaşılsın diye. Cevap OKUNMAZ. */
  questionStem: string
  questionIsPublished: boolean
}

/**
 * Videonun durakları, soru kökleriyle.
 *
 * Öğrenci tarafındaki `getCheckpointsForVideo` yayımdan kalkmış sorulu
 * durakları LİSTEDEN DÜŞÜRÜR (oynatıcıyı kilitlememek için). Yönetimde tam
 * tersi gerekir: editör bozuk durağı görmeli ki kaldırabilsin. Bu yüzden
 * burada hepsi listelenir ve sorunun yayın durumu ayrı bir alan olarak döner.
 */
export async function getAdminCheckpoints(
  client: Client,
  videoId: string,
): Promise<AdminCheckpoint[]> {
  const { data, error } = await client
    .from('video_checkpoints')
    .select('id, video_id, question_id, timestamp_seconds, order_index')
    .eq('video_id', videoId)
    .is('deleted_at', null)
    .order('timestamp_seconds', { ascending: true })

  if (error) throw new AppError('internal', 'Video durakları yüklenemedi.')
  const rows = data ?? []
  if (rows.length === 0) return []

  const { data: questions, error: questionError } = await client
    .from('questions')
    .select('id, stem, is_published')
    .in(
      'id',
      rows.map((row) => row.question_id),
    )

  if (questionError) throw new AppError('internal', 'Durak soruları yüklenemedi.')
  const questionById = new Map((questions ?? []).map((question) => [question.id, question]))

  return rows.map((row) => {
    const question = questionById.get(row.question_id)
    return {
      id: row.id,
      videoId: row.video_id,
      timestampSeconds: row.timestamp_seconds,
      orderIndex: row.order_index,
      questionId: row.question_id,
      questionStem: question?.stem ?? 'Soru bulunamadı.',
      questionIsPublished: question?.is_published ?? false,
    }
  })
}

/** Yalnızca saniyeler — `validateCheckpointTimestamp` çakışma denetimi için. */
export async function getCheckpointTimestamps(client: Client, videoId: string): Promise<number[]> {
  const { data, error } = await client
    .from('video_checkpoints')
    .select('timestamp_seconds')
    .eq('video_id', videoId)
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Video durakları yüklenemedi.')
  return (data ?? []).map((row) => row.timestamp_seconds)
}

// ---------------------------------------------------------------------------
// Soru havuzu
// ---------------------------------------------------------------------------

export type QuestionOption = {
  id: string
  topicId: string
  type: string
  /** Soru kökü. Uzun kökler arayüzde kırpılır, burada tam metin döner. */
  stem: string
  difficulty: number
  isPublished: boolean
}

const QUESTION_COLUMNS = 'id, topic_id, type, stem, difficulty, is_published'

/**
 * Soru arama (durak seçici ve test kurucusu).
 *
 * `search_vector` yerine `ilike` kullanılır: aranan şey genelde kökten bir
 * kelime öbeği ve sonuç kümesi konuyla zaten daraltılmış oluyor. Tam metin
 * araması soru düzenleyicisinin (ayrı modül) işidir.
 */
export async function searchAdminQuestions(
  client: Client,
  options: { topicIds?: readonly string[]; text?: string | null; limit?: number },
): Promise<QuestionOption[]> {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100)

  let query = client
    .from('questions')
    .select(QUESTION_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.topicIds && options.topicIds.length > 0) {
    query = query.in('topic_id', [...options.topicIds])
  }

  const text = (options.text ?? '').trim()
  if (text !== '') {
    // `%` ve `,` PostgREST filtre dizesinde anlamlı; kaçırılmazsa arama bozulur.
    query = query.ilike('stem', `%${text.replace(/[%,]/g, ' ')}%`)
  }

  const { data, error } = await query
  if (error) throw new AppError('internal', 'Sorular yüklenemedi.')

  return (data ?? []).map(toQuestionOption)
}

/** Belirli kimliklerdeki sorular — seçili soruların satırını doldurmak için. */
export async function getAdminQuestionsByIds(
  client: Client,
  questionIds: readonly string[],
): Promise<QuestionOption[]> {
  const unique = [...new Set(questionIds)]
  if (unique.length === 0) return []

  const { data, error } = await client
    .from('questions')
    .select(QUESTION_COLUMNS)
    .in('id', unique)
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Sorular yüklenemedi.')
  return (data ?? []).map(toQuestionOption)
}

function toQuestionOption(row: {
  id: string
  topic_id: string
  type: string
  stem: string
  difficulty: number
  is_published: boolean
}): QuestionOption {
  return {
    id: row.id,
    topicId: row.topic_id,
    type: row.type,
    stem: row.stem,
    difficulty: row.difficulty,
    isPublished: row.is_published,
  }
}

/**
 * Bir konunun yayımlanmış soru kimlikleri — "bu konudan rastgele N soru"
 * kuralının havuzu.
 */
export async function getPublishedQuestionIdsForTopics(
  client: Client,
  topicIds: readonly string[],
): Promise<string[]> {
  if (topicIds.length === 0) return []

  const { data, error } = await client
    .from('questions')
    .select('id')
    .in('topic_id', [...topicIds])
    .eq('is_published', true)
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Soru havuzu okunamadı.')
  return (data ?? []).map((row) => row.id)
}

export type SubjectPool = {
  subjectId: string
  /** `test_questions.section` bu ADI alır — `lib/mock/sections.ts` ona göre gruplar. */
  subjectName: string
  questionIds: string[]
}

/**
 * Bir sınavın her dersi için yayımlanmış soru havuzu.
 *
 * Hem "kaç soru var?" uyarısı hem de denemenin kurulması aynı veriyi ister;
 * iki ayrı sorgu yazmak yerine havuz bir kez okunur, sayı uzunluğundan gelir.
 *
 * HAVUZ KISALIĞI BEKLENEN DURUMDUR: şu an 1164 konudan yalnızca üçünde soru
 * var. Boş havuzlu ders listeden düşmez, `questionIds: []` ile döner — arayüz
 * "0 soru" yazabilsin diye.
 */
export async function getSubjectPools(client: Client, examId: string): Promise<SubjectPool[]> {
  const subjects = await getAdminSubjects(client, examId)
  if (subjects.length === 0) return []

  const { data: units, error: unitError } = await client
    .from('units')
    .select('id, subject_id')
    .in(
      'subject_id',
      subjects.map((subject) => subject.id),
    )
    .is('deleted_at', null)

  if (unitError) throw new AppError('internal', 'Üniteler yüklenemedi.')
  const unitRows = units ?? []

  const { data: topics, error: topicError } =
    unitRows.length === 0
      ? { data: [], error: null }
      : await client
          .from('topics')
          .select('id, unit_id')
          .in(
            'unit_id',
            unitRows.map((unit) => unit.id),
          )
          .is('deleted_at', null)

  if (topicError) throw new AppError('internal', 'Konular yüklenemedi.')
  const topicRows = topics ?? []

  const subjectByUnit = new Map(unitRows.map((unit) => [unit.id, unit.subject_id]))
  const subjectByTopic = new Map<string, string>()
  for (const topic of topicRows) {
    const subjectId = subjectByUnit.get(topic.unit_id)
    if (subjectId) subjectByTopic.set(topic.id, subjectId)
  }

  const questionIds = await getPublishedQuestionIdsWithTopic(client, [...subjectByTopic.keys()])

  const poolBySubject = new Map<string, string[]>(
    subjects.map((subject) => [subject.id, [] as string[]]),
  )
  for (const row of questionIds) {
    const subjectId = subjectByTopic.get(row.topicId)
    if (!subjectId) continue
    poolBySubject.get(subjectId)?.push(row.id)
  }

  return subjects.map((subject) => ({
    subjectId: subject.id,
    subjectName: subject.name,
    questionIds: poolBySubject.get(subject.id) ?? [],
  }))
}

async function getPublishedQuestionIdsWithTopic(
  client: Client,
  topicIds: readonly string[],
): Promise<{ id: string; topicId: string }[]> {
  if (topicIds.length === 0) return []

  const { data, error } = await client
    .from('questions')
    .select('id, topic_id')
    .in('topic_id', [...topicIds])
    .eq('is_published', true)
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Soru havuzu okunamadı.')
  return (data ?? []).map((row) => ({ id: row.id, topicId: row.topic_id }))
}

// ---------------------------------------------------------------------------
// Testler ve denemeler
// ---------------------------------------------------------------------------

export type AdminTestListItem = {
  test: AdminTest
  questionCount: number
}

/**
 * Yönetim listesi. `types` ile konu/ünite testleri ile denemeler ayrılır;
 * iki ekran aynı tabloyu farklı süzgeçle gösterir.
 */
export async function getAdminTests(
  client: Client,
  options: { types: readonly AdminTest['type'][]; limit?: number },
): Promise<AdminTestListItem[]> {
  const { data, error } = await client
    .from('tests')
    .select('*')
    .in('type', [...options.types])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(options.limit ?? 100, 200))

  if (error) throw new AppError('internal', 'Testler yüklenemedi.')
  const tests = data ?? []
  if (tests.length === 0) return []

  const { data: links, error: linkError } = await client
    .from('test_questions')
    .select('test_id')
    .in(
      'test_id',
      tests.map((test) => test.id),
    )

  if (linkError) throw new AppError('internal', 'Test soruları sayılamadı.')

  const countByTest = new Map<string, number>()
  for (const link of links ?? []) {
    countByTest.set(link.test_id, (countByTest.get(link.test_id) ?? 0) + 1)
  }

  return tests.map((test) => ({ test, questionCount: countByTest.get(test.id) ?? 0 }))
}

export async function getAdminTest(client: Client, testId: string): Promise<AdminTest> {
  const { data, error } = await client
    .from('tests')
    .select('*')
    .eq('id', testId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Test yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız test bulunamadı.')
  return data
}

export type AdminTestQuestion = {
  questionId: string
  orderIndex: number
  section: string | null
  stem: string
  difficulty: number
  isPublished: boolean
}

/** Testin soruları, sırasıyla ve kökleriyle. */
export async function getAdminTestQuestions(
  client: Client,
  testId: string,
): Promise<AdminTestQuestion[]> {
  const { data, error } = await client
    .from('test_questions')
    .select('question_id, order_index, section')
    .eq('test_id', testId)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Test soruları yüklenemedi.')
  const rows = data ?? []
  if (rows.length === 0) return []

  const questions = await getAdminQuestionsByIds(
    client,
    rows.map((row) => row.question_id),
  )
  const byId = new Map(questions.map((question) => [question.id, question]))

  return rows.map((row) => {
    const question = byId.get(row.question_id)
    return {
      questionId: row.question_id,
      orderIndex: row.order_index,
      section: row.section,
      stem: question?.stem ?? 'Soru bulunamadı.',
      difficulty: question?.difficulty ?? 3,
      isPublished: question?.isPublished ?? false,
    }
  })
}

// ---------------------------------------------------------------------------
// Bilgi kartları
// ---------------------------------------------------------------------------

/**
 * Konunun EDİTÖR kartları.
 *
 * `auto_generated = false` süzgeci zorunlu: `auto_generated` kartlar bir
 * öğrencinin kendi yanlışından üretilmiş, `created_by` ile ona bağlı KİŞİSEL
 * kartlardır. Yönetim ekranında düzenlenmeleri hem mahremiyet ihlali olur hem
 * de sahibinin tekrar kuyruğunu bozar. Editör kartı ise `created_by = null`
 * ile herkese açıktır (bkz. 0004_content.sql, `flashcards.created_by` yorumu).
 */
export async function getAdminFlashcards(
  client: Client,
  topicId: string,
): Promise<AdminFlashcard[]> {
  const { data, error } = await client
    .from('flashcards')
    .select('*')
    .eq('topic_id', topicId)
    .eq('auto_generated', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new AppError('internal', 'Kartlar yüklenemedi.')
  return data ?? []
}

export async function getAdminFlashcard(client: Client, cardId: string): Promise<AdminFlashcard> {
  const { data, error } = await client
    .from('flashcards')
    .select('*')
    .eq('id', cardId)
    .eq('auto_generated', false)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Kart yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız kart bulunamadı.')
  return data
}
