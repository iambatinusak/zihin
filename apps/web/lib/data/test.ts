import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
// Şık ayrıştırma nötr modülde yaşar: aynı kopyayı istemcideki checkpoint
// kaplaması da kullanır (bkz. lib/questions/options.ts).
import { parseOptions, type QuestionOption } from '@/lib/questions/options'
import { AppError } from '@/lib/errors'

/**
 * Test motorunun okuma katmanı.
 *
 * GÜVENLİK KURALI: buradaki hiçbir fonksiyon `public.questions` tablosuna
 * dokunmaz. `correct_option` ve `explanation` kolonları `authenticated`
 * rolünden geri alınmıştır; doğrudan select çalışma anında hata verir. Soru
 * gösterimi daima `questions_public` görünümünden okunur. Doğru cevap yalnızca
 * service-role istemcisiyle, yalnızca puanlama ve sonuç ekranı için okunur —
 * o okumalar `readAnswerKey` üzerinden yapılır ve çağıranın oturumu bitirmiş
 * olmasını doğrulaması beklenir.
 */

type Client = DataClient

export type TestRow = Tables<'tests'>
export type TestSessionRow = Tables<'test_sessions'>
export type AttemptRow = Tables<'attempts'>
export type BookmarkRow = Tables<'bookmarked_questions'>

/** Testin çözüm sırasında istemciye giden hâli. */
export type TestQuestionOption = QuestionOption

export type PublicQuestion = {
  id: string
  topicId: string
  type: string
  stem: string
  options: TestQuestionOption[]
  imageUrl: string | null
  difficulty: number
  expectedSeconds: number | null
  /** Testteki yayım sırası; karıştırılmış sıra oturumda ayrıca tutulur. */
  orderIndex: number
  section: string | null
}

/** Yalnızca sunucuda, yalnızca puanlama ve sonuç için okunan cevap anahtarı. */
export type AnswerKeyRow = {
  id: string
  topicId: string
  correctOption: string
  explanation: string | null
  solutionVideoUrl: string | null
}

/* ------------------------------------------------------------------------- *
 * Testler
 * ------------------------------------------------------------------------- */

/** Kimliği verilen yayımlanmış testi döner. */
export async function getTestById(client: Client, testId: string): Promise<TestRow> {
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

/** Bir konunun yayımlanmış testleri. */
export async function getTestsForTopic(client: Client, topicId: string): Promise<TestRow[]> {
  const { data, error } = await client
    .from('tests')
    .select('*')
    .eq('topic_id', topicId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new AppError('internal', 'Testler yüklenemedi.')
  return data ?? []
}

/** Bir ünitenin yayımlanmış testleri. */
export async function getTestsForUnit(client: Client, unitId: string): Promise<TestRow[]> {
  const { data, error } = await client
    .from('tests')
    .select('*')
    .eq('unit_id', unitId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new AppError('internal', 'Testler yüklenemedi.')
  return data ?? []
}

/**
 * Bir testin sorularını, cevap kolonları OLMADAN döner.
 *
 * İki düz sorgu: önce `test_questions` bağı (sıra bilgisi orada), sonra
 * `questions_public`. İç içe select kullanılmaz — üretilen tipler ilişki
 * taşımıyor (CONVENTIONS §5'in düz sorgu kuralı).
 */
export async function getTestQuestions(client: Client, testId: string): Promise<PublicQuestion[]> {
  const { data: linkRows, error: linkError } = await client
    .from('test_questions')
    .select('question_id, order_index, section')
    .eq('test_id', testId)
    .order('order_index', { ascending: true })

  if (linkError) throw new AppError('internal', 'Test soruları yüklenemedi.')
  const links = linkRows ?? []
  if (links.length === 0) return []

  const { data: questionRows, error: questionError } = await client
    .from('questions_public')
    .select('id, topic_id, type, stem, options, image_url, difficulty, expected_seconds')
    .in(
      'id',
      links.map((link) => link.question_id),
    )
    .eq('is_published', true)

  if (questionError) throw new AppError('internal', 'Test soruları yüklenemedi.')

  const byId = new Map(
    (questionRows ?? []).flatMap((row) => (row.id ? [[row.id, row] as const] : [])),
  )

  const questions: PublicQuestion[] = []
  for (const link of links) {
    const row = byId.get(link.question_id)
    // Yayımdan kaldırılmış soru teste bağlı kalmış olabilir; sessizce atlanır.
    if (!row || !row.id || !row.topic_id) continue
    questions.push({
      id: row.id,
      topicId: row.topic_id,
      type: row.type ?? 'multiple_choice',
      stem: row.stem ?? '',
      options: parseOptions(row.options),
      imageUrl: row.image_url,
      difficulty: row.difficulty ?? 3,
      expectedSeconds: row.expected_seconds,
      orderIndex: link.order_index,
      section: link.section,
    })
  }
  return questions
}

/* ------------------------------------------------------------------------- *
 * Oturumlar
 * ------------------------------------------------------------------------- */

/**
 * Kimliği verilen oturumu döner. Sahiplik denetimi çağıranın işidir; bu
 * fonksiyon RLS'e ek olarak `user_id` filtresini de yazar ki sorgu okunduğunda
 * kimin verisi olduğu görünsün.
 */
export async function getSession(
  client: Client,
  sessionId: string,
  userId: string,
): Promise<TestSessionRow> {
  const { data, error } = await client
    .from('test_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Test oturumu yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Test oturumu bulunamadı.')
  return data
}

/**
 * Kullanıcının bu testteki bitmemiş oturumu (varsa). Süresi dolmuş olabilir —
 * "sürdürülebilir mi" kararını `isSessionResumable` verir, bu okuma zaman
 * kıyaslaması yapmaz.
 */
export async function getActiveSession(
  client: Client,
  userId: string,
  testId: string,
): Promise<TestSessionRow | null> {
  const { data, error } = await client
    .from('test_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('test_id', testId)
    .is('finished_at', null)
    .order('started_at', { ascending: false })
    .limit(1)

  if (error) throw new AppError('internal', 'Test oturumu yüklenemedi.')
  return (data ?? [])[0] ?? null
}

/** Bir oturumda verilmiş cevaplar. */
export async function getSessionAttempts(
  client: Client,
  sessionId: string,
  userId: string,
): Promise<AttemptRow[]> {
  const { data, error } = await client
    .from('attempts')
    .select('*')
    .eq('test_session_id', sessionId)
    .eq('user_id', userId)
    .order('answered_at', { ascending: true })

  if (error) throw new AppError('internal', 'Cevaplar yüklenemedi.')
  return data ?? []
}

/**
 * Kullanıcının bitirdiği son oturumlar — "geçmiş testlerim" listesi için.
 */
export async function getFinishedSessions(
  client: Client,
  userId: string,
  limit = 20,
): Promise<TestSessionRow[]> {
  const { data, error } = await client
    .from('test_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(limit)

  if (error) throw new AppError('internal', 'Geçmiş testler yüklenemedi.')
  return data ?? []
}

/* ------------------------------------------------------------------------- *
 * Cevap anahtarı — YALNIZCA service-role istemcisiyle
 * ------------------------------------------------------------------------- */

/**
 * Doğru cevapları okur. Çağıran taraf `createSupabaseAdminClient()` geçirmek
 * ZORUNDADIR; normal oturum istemcisiyle bu sorgu zaten hata verir çünkü
 * `correct_option` ve `explanation` `authenticated` rolünden geri alınmıştır.
 *
 * Meşru iki çağrı yeri var: (1) cevap kaydedilirken sunucu tarafı puanlama,
 * (2) oturum bittikten sonra sonuç ekranı. İkincisinde çağıran `finished_at`
 * dolu olduğunu doğrulamış olmalıdır.
 */
export async function readAnswerKey(
  adminClient: Client,
  questionIds: readonly string[],
): Promise<Map<string, AnswerKeyRow>> {
  if (questionIds.length === 0) return new Map()

  const { data, error } = await adminClient
    .from('questions')
    .select('id, topic_id, correct_option, explanation, solution_video_url')
    .in('id', [...questionIds])

  if (error) throw new AppError('internal', 'Cevaplar doğrulanamadı.')

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        topicId: row.topic_id,
        correctOption: row.correct_option,
        explanation: row.explanation,
        solutionVideoUrl: row.solution_video_url,
      },
    ]),
  )
}

/* ------------------------------------------------------------------------- *
 * Yanlış soru defteri
 * ------------------------------------------------------------------------- */

/** Kullanıcının işaretlediği soruların kimlikleri (verilen küme içinden). */
export async function getBookmarkedQuestionIds(
  client: Client,
  userId: string,
  questionIds: readonly string[],
): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set()

  const { data, error } = await client
    .from('bookmarked_questions')
    .select('question_id')
    .eq('user_id', userId)
    .in('question_id', [...questionIds])

  if (error) throw new AppError('internal', 'Kaydedilen sorular yüklenemedi.')
  return new Set((data ?? []).map((row) => row.question_id))
}

/** Yanlış soru defterinin tamamı, en yeniden eskiye. */
export async function getBookmarks(
  client: Client,
  userId: string,
  limit = 100,
): Promise<BookmarkRow[]> {
  const { data, error } = await client
    .from('bookmarked_questions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new AppError('internal', 'Yanlış soru defteri yüklenemedi.')
  return data ?? []
}

/* ------------------------------------------------------------------------- *
 * Yanlış cevap katsayısı
 * ------------------------------------------------------------------------- */

/**
 * Testin bağlı olduğu sınavın yanlış katsayısı (LGS 3, diğerleri 4).
 * Test bir sınava bağlı değilse (konu testleri çoğu zaman öyle) kullanıcının
 * hedef sınavına bakılır; o da yoksa varsayılan 4'tür.
 */
export async function getWrongPenaltyDivisor(
  client: Client,
  examId: string | null,
): Promise<3 | 4> {
  if (!examId) return 4

  const { data, error } = await client
    .from('exams')
    .select('wrong_penalty_divisor')
    .eq('id', examId)
    .maybeSingle()

  if (error || !data) return 4
  return data.wrong_penalty_divisor === 3 ? 3 : 4
}

/** Bir konunun bağlı olduğu sınavın kimliği (konu → ünite → ders → sınav). */
export async function getExamIdForTopic(client: Client, topicId: string): Promise<string | null> {
  const { data: topic, error: topicError } = await client
    .from('topics')
    .select('unit_id')
    .eq('id', topicId)
    .is('deleted_at', null)
    .maybeSingle()

  if (topicError || !topic) return null

  const { data: unit, error: unitError } = await client
    .from('units')
    .select('subject_id')
    .eq('id', topic.unit_id)
    .maybeSingle()

  if (unitError || !unit) return null

  const { data: subject, error: subjectError } = await client
    .from('subjects')
    .select('exam_id')
    .eq('id', unit.subject_id)
    .maybeSingle()

  if (subjectError || !subject) return null
  return subject.exam_id
}

/* ------------------------------------------------------------------------- *
 * Hızlı tekrar (quick practice) seçimi
 * ------------------------------------------------------------------------- */

export type WeakTopicRow = { topicId: string; mastery: number; attemptsCount: number }

/**
 * Kullanıcının en zayıf konuları, yetkinlik puanına göre artan sırada.
 * `unknown` durumundaki konular da listeye girer: hiç ölçülmemiş bir konu
 * çalışılmaya en az güçlü bir konu kadar adaydır.
 */
export async function getWeakestTopics(
  client: Client,
  userId: string,
  limit = 20,
): Promise<WeakTopicRow[]> {
  const { data, error } = await client
    .from('topic_mastery')
    .select('topic_id, mastery, attempts_count')
    .eq('user_id', userId)
    .order('mastery', { ascending: true })
    .limit(limit)

  if (error) throw new AppError('internal', 'Yetkinlik bilgisi yüklenemedi.')
  return (data ?? []).map((row) => ({
    topicId: row.topic_id,
    mastery: row.mastery,
    attemptsCount: row.attempts_count,
  }))
}

/** Bir konunun yayımlanmış soru kimlikleri (cevap kolonlarına dokunmadan). */
export async function getPublishedQuestionIdsForTopic(
  client: Client,
  topicId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('questions_public')
    .select('id')
    .eq('topic_id', topicId)
    .eq('is_published', true)

  if (error) throw new AppError('internal', 'Sorular yüklenemedi.')
  return (data ?? []).flatMap((row) => (row.id ? [row.id] : []))
}

/**
 * Konunun hızlı tekrar testi (varsa).
 *
 * KARAR: konu başına TEK bir `quick_practice` test satırı tutulur, her oturumda
 * yenisi açılmaz. Sebep: `test_sessions.test_id` zorunlu bir yabancı anahtar,
 * yani oturum bir test satırı olmadan var olamaz. Her hızlı tekrarda yeni satır
 * açmak `tests` tablosunu kullanıcı sayısı × konu sayısı kadar çöp kayıtla
 * şişirir ve "bu testi kaç kişi çözdü" türü her sorguyu anlamsızlaştırırdı.
 * Tek satırla yürür; oturumdaki asıl değişken olan soru seçimi zaten
 * `test_sessions.question_order` içinde tutuluyor.
 */
export async function findQuickPracticeTest(
  client: Client,
  topicId: string,
): Promise<TestRow | null> {
  const { data, error } = await client
    .from('tests')
    .select('*')
    .eq('type', 'quick_practice')
    .eq('topic_id', topicId)
    .is('deleted_at', null)
    .limit(1)

  if (error) throw new AppError('internal', 'Test yüklenemedi.')
  return (data ?? [])[0] ?? null
}

/**
 * Konunun hızlı tekrar testini oluşturur ve konunun tüm yayımlanmış sorularını
 * ona bağlar. Oturum başına seçilen 5 soru bu havuzdan `question_order` ile
 * ayrılır; test satırı havuzun kendisidir.
 *
 * Service-role istemcisi ister: `tests` tablosuna yazma yetkisi öğrencide yok.
 */
export async function createQuickPracticeTest(
  adminClient: Client,
  input: { topicId: string; title: string; examId: string | null; questionIds: string[] },
): Promise<TestRow> {
  const { data, error } = await adminClient
    .from('tests')
    .insert({
      type: 'quick_practice',
      title: input.title,
      topic_id: input.topicId,
      exam_id: input.examId,
      is_published: true,
      config: { generated: 'quick_practice' },
    })
    .select('*')
    .single()

  if (error || !data) throw new AppError('internal', 'Hızlı tekrar testi oluşturulamadı.')

  if (input.questionIds.length > 0) {
    const { error: linkError } = await adminClient.from('test_questions').insert(
      input.questionIds.map((questionId, index) => ({
        test_id: data.id,
        question_id: questionId,
        order_index: index,
      })),
    )
    if (linkError) throw new AppError('internal', 'Hızlı tekrar testi oluşturulamadı.')
  }

  return data
}

/* ------------------------------------------------------------------------- *
 * Yazma işlemleri
 * ------------------------------------------------------------------------- */

/** Yeni bir çözüm oturumu açar. `expires_at` varsayılanı veritabanında 24 saattir. */
export async function insertSession(
  client: Client,
  input: { userId: string; testId: string; questionOrder: string[]; isPlacement?: boolean },
): Promise<TestSessionRow> {
  const { data, error } = await client
    .from('test_sessions')
    .insert({
      user_id: input.userId,
      test_id: input.testId,
      question_order: input.questionOrder,
      is_placement: input.isPlacement ?? false,
    })
    .select('*')
    .single()

  if (error || !data) throw new AppError('internal', 'Test oturumu başlatılamadı.')
  return data
}

/**
 * Bir oturumda aynı soruya ait mevcut cevabı bulur.
 * Şıkkını değiştiren öğrenci için ikinci satır AÇILMAZ, bu satır güncellenir.
 */
export async function findSessionAttempt(
  client: Client,
  input: { sessionId: string; userId: string; questionId: string },
): Promise<AttemptRow | null> {
  const { data, error } = await client
    .from('attempts')
    .select('*')
    .eq('test_session_id', input.sessionId)
    .eq('user_id', input.userId)
    .eq('question_id', input.questionId)
    .limit(1)

  if (error) throw new AppError('internal', 'Cevap kaydedilemedi.')
  return (data ?? [])[0] ?? null
}

/**
 * Kullanıcının bu soruyu BAŞKA oturumlarda kaç kez çözdüğü.
 * `repeat_index` bu sayıdan gelir: 0 = ilk çözüm. Yetkinlik motoru 0'dan büyük
 * tekrarları düşük ağırlıkla sayar (bkz. migration 0005 yorumu).
 */
export async function countPriorAttempts(
  client: Client,
  input: { userId: string; questionId: string; excludeSessionId: string },
): Promise<number> {
  const { count, error } = await client
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .eq('question_id', input.questionId)
    .neq('test_session_id', input.excludeSessionId)

  if (error) throw new AppError('internal', 'Cevap kaydedilemedi.')
  return count ?? 0
}

export type AttemptWrite = {
  userId: string
  questionId: string
  topicId: string
  sessionId: string
  source: Tables<'attempts'>['source']
  selectedOption: string | null
  isCorrect: boolean
  timeSpentMs: number
  repeatIndex: number
}

/** Yeni cevap satırı ekler. */
export async function insertAttempt(client: Client, input: AttemptWrite): Promise<void> {
  const { error } = await client.from('attempts').insert({
    user_id: input.userId,
    question_id: input.questionId,
    topic_id: input.topicId,
    test_session_id: input.sessionId,
    source: input.source,
    selected_option: input.selectedOption,
    is_correct: input.isCorrect,
    time_spent_ms: input.timeSpentMs,
    repeat_index: input.repeatIndex,
  })

  if (error) throw new AppError('internal', 'Cevap kaydedilemedi.')
}

/**
 * Mevcut cevap satırını günceller (öğrenci şıkkını değiştirdi).
 *
 * SERVICE-ROLE İSTEMCİSİ İSTER. `attempts` migration 0011'de bilerek
 * salt-ekleme bırakıldı: `authenticated` rolü için UPDATE politikası yok, çünkü
 * öğrencinin yanlış çözümlerini düzeltebilmesi yetkinlik hesabını sessizce
 * şişirirdi. Oturum içinde şık değiştirmek ise meşru — aynı soru için ikinci
 * satır açmak özeti bozardı — bu yüzden yazma sunucuda yapılır.
 *
 * `attemptId` doğrudan kullanıcı girdisinden GELMEZ: çağıran önce oturumun
 * sahipliğini doğrular, sonra satırı `findSessionAttempt` ile bulur. `user_id`
 * filtresi RLS kapalıyken de yanlış satıra yazmayı engellemek için burada
 * tekrar yazılır (CONVENTIONS §4).
 */
export async function updateAttempt(
  adminClient: Client,
  input: {
    attemptId: string
    userId: string
    selectedOption: string | null
    isCorrect: boolean
    timeSpentMs: number
  },
): Promise<void> {
  const { error } = await adminClient
    .from('attempts')
    .update({
      selected_option: input.selectedOption,
      is_correct: input.isCorrect,
      time_spent_ms: input.timeSpentMs,
      answered_at: new Date().toISOString(),
    })
    .eq('id', input.attemptId)
    .eq('user_id', input.userId)

  if (error) throw new AppError('internal', 'Cevap kaydedilemedi.')
}

/**
 * Oturumu bitirir. `finished_at is null` KOŞULU ile yazılır: aynı anda gelen
 * ikinci bir bitirme hiçbir satırı etkilemez, özet iki kez yazılmaz.
 * Güncellenen satır sayısını döner — 0 ise oturum zaten bitmişti.
 */
export async function finishSession(
  client: Client,
  input: { sessionId: string; userId: string; summary: unknown },
): Promise<number> {
  const { data, error } = await client
    .from('test_sessions')
    .update({
      finished_at: new Date().toISOString(),
      summary: input.summary as Tables<'test_sessions'>['summary'],
    })
    .eq('id', input.sessionId)
    .eq('user_id', input.userId)
    .is('finished_at', null)
    .select('id')

  if (error) throw new AppError('internal', 'Test bitirilemedi.')
  return (data ?? []).length
}

/** Yanlış soru defterine ekler ya da notunu günceller. */
export async function upsertBookmark(
  client: Client,
  input: { userId: string; questionId: string; note: string | null },
): Promise<void> {
  const { error } = await client
    .from('bookmarked_questions')
    .upsert(
      { user_id: input.userId, question_id: input.questionId, note: input.note },
      { onConflict: 'user_id,question_id' },
    )

  if (error) throw new AppError('internal', 'Soru kaydedilemedi.')
}

/** Yanlış soru defterinden çıkarır. */
export async function deleteBookmark(
  client: Client,
  input: { userId: string; questionId: string },
): Promise<void> {
  const { error } = await client
    .from('bookmarked_questions')
    .delete()
    .eq('user_id', input.userId)
    .eq('question_id', input.questionId)

  if (error) throw new AppError('internal', 'Soru defterden çıkarılamadı.')
}
