import 'server-only'

import { calculateMockSummary } from '@zihin/core'
import type { MockAttemptInput, MockSectionInput, WrongPenaltyDivisor } from '@zihin/core'
import { AppError } from '@/lib/errors'
import { weekInstantRange, weekRange } from '@/lib/parent/week'
import { getMasteryMap, type MasteryTopicEntry } from './mastery'
import type { DataClient } from './client'

/**
 * Veli panelinin okuma katmanı (spec §M12).
 *
 * ── SALT OKUMA ─────────────────────────────────────────────────────────────
 * Bu dosyada tek bir yazma yoktur ve olmayacaktır. Veli hiçbir içeriği
 * izleyemez/çözemez; panel yalnızca öğrencinin ürettiği veriyi özetler.
 *
 * ── GÜVENLİK ───────────────────────────────────────────────────────────────
 * `studentId` HER ZAMAN velinin `parent_links` kümesinden doğrulanmış olarak
 * gelir (`resolveSelectedStudent`, lib/parent/select.ts). Buradaki sorgular
 * normal oturum istemcisiyle çalışır: RLS'in `can_read_student_data()`
 * yordamı veliye yalnızca bağlı olduğu öğrencinin satırlarını açar. Yani
 * uygulama katmanı yanılsa bile veritabanı ikinci kez denetler (CONVENTIONS §3).
 *
 * Sorgular düz tutulur (üretilen tiplerde `Relationships: []`), ağaç bellekte
 * kurulur.
 */

type Client = DataClient

/** Tek okumada çekilecek satır sayısı; deneme/çözüm sayısı öngörülemez. */
const PAGE_SIZE = 1000

/** Yanlış katsayısı bilinmiyorsa TYT/AYT varsayılanı. */
const DEFAULT_DIVISOR: WrongPenaltyDivisor = 4

export type ParentWeeklySummary = {
  /** Haftanın Pazartesi'si (YYYY-MM-DD). */
  weekStart: string
  studySeconds: number
  studyMinutes: number
  videosCompleted: number
  questionsAnswered: number
  correctAnswers: number
  /** Doğruluk yüzdesi (0-100). Hiç soru çözülmediyse null — "%0" yanıltıcı olurdu. */
  accuracyPercent: number | null
  blocksCompleted: number
  blocksPlanned: number
}

export type ParentWeeklyComparison = {
  current: ParentWeeklySummary
  previous: ParentWeeklySummary
}

/**
 * Bir haftanın özeti. Beş kaynak ayrı ayrı okunur; her biri kendi tablosunun
 * doğal zaman kolonuyla filtrelenir (tarih kolonları gün, zaman damgası
 * kolonları Türkiye gününe sabitlenmiş an aralığıyla).
 */
export async function getWeeklySummary(
  client: Client,
  studentId: string,
  weekStart: string,
): Promise<ParentWeeklySummary> {
  const days = weekRange(weekStart)
  const instants = weekInstantRange(weekStart)

  const [studySeconds, videosCompleted, answers, blocks] = await Promise.all([
    readStudySeconds(client, studentId, days),
    readVideosCompleted(client, studentId, instants),
    readAnswerCounts(client, studentId, instants),
    readBlockCounts(client, studentId, days),
  ])

  return {
    weekStart: days.start,
    studySeconds,
    studyMinutes: Math.round(studySeconds / 60),
    videosCompleted,
    questionsAnswered: answers.total,
    correctAnswers: answers.correct,
    accuracyPercent:
      answers.total === 0 ? null : Math.round((answers.correct / answers.total) * 100),
    blocksCompleted: blocks.completed,
    blocksPlanned: blocks.planned,
  }
}

/** Seçili hafta + bir önceki hafta; oklar bu ikisinin farkından çıkar. */
export async function getWeeklyComparison(
  client: Client,
  studentId: string,
  weekStart: string,
  previousWeek: string,
): Promise<ParentWeeklyComparison> {
  const [current, previous] = await Promise.all([
    getWeeklySummary(client, studentId, weekStart),
    getWeeklySummary(client, studentId, previousWeek),
  ])
  return { current, previous }
}

export type ParentWeakTopic = {
  topicId: string
  title: string
  subjectName: string
  mastery: number
  status: MasteryTopicEntry['status']
  attemptsCount: number
}

/**
 * Öğrencinin zayıf konuları — öğrencinin gördüğü veriyle AYNI kaynak
 * (`topic_mastery`), yalnızca salt okunur sunulur.
 *
 * Hiç ölçülmemiş konu (`unknown`) listeye GİRMEZ: veliye "zayıf" diye
 * gösterilen şey ölçülmüş bir sonuç olmalı, ölçüm eksikliği değil.
 */
export async function getWeakTopics(
  client: Client,
  studentId: string,
  examId: string,
  limit = 6,
): Promise<ParentWeakTopic[]> {
  const map = await getMasteryMap(client, studentId, examId)

  const entries: ParentWeakTopic[] = []
  for (const subject of map.subjects) {
    for (const unit of subject.units) {
      for (const topic of unit.topics) {
        if (topic.status === 'unknown' || topic.status === 'strong') continue
        entries.push({
          topicId: topic.topicId,
          title: topic.title,
          subjectName: subject.name,
          mastery: topic.mastery,
          status: topic.status,
          attemptsCount: topic.attemptsCount,
        })
      }
    }
  }

  entries.sort((a, b) => a.mastery - b.mastery)
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 6
  return entries.slice(0, safeLimit)
}

export type ParentMockSection = {
  subjectId: string
  subjectName: string
  correct: number
  wrong: number
  blank: number
  net: number
}

export type ParentMockResult = {
  sessionId: string
  title: string
  finishedAt: string
  net: number
  correct: number
  wrong: number
  blank: number
  /** En az 20 katılımcı yoksa null (spec §M10, `MIN_PERCENTILE_SAMPLE`). */
  percentile: number | null
  sections: ParentMockSection[]
}

/**
 * Son bitmiş deneme sınavları, ders bazlı netleriyle.
 *
 * Netleri burada YENİDEN TÜRETMİYORUZ: kırılım `calculateMockSummary`
 * (packages/core) ile hesaplanır. Soru → konu eşlemesi `questions_public`
 * görünümünden okunur — `public.questions` doğru cevabı taşır ve istemci
 * bağlamındaki hiçbir yol onu okumaz (CONVENTIONS §4).
 *
 * `mock.ts` başka bir ajanın mülkiyetinde olduğu için okuyucu burada dar
 * tutuldu; oradaki genel deneme katmanı hazır olduğunda bu fonksiyon ona
 * devredilebilir.
 */
export async function getRecentMockResults(
  client: Client,
  studentId: string,
  limit = 3,
  scanLimit = 30,
): Promise<ParentMockResult[]> {
  const { data: sessionRows, error } = await client
    .from('test_sessions')
    .select('id, test_id, finished_at, summary, percentile, question_order')
    .eq('user_id', studentId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(scanLimit)

  if (error) throw new AppError('internal', 'Deneme sonuçları yüklenemedi.')

  const sessions = sessionRows ?? []
  if (sessions.length === 0) return []

  const { data: testRows, error: testError } = await client
    .from('tests')
    .select('id, title, type, exam_id')
    .in('id', [...new Set(sessions.map((row) => row.test_id))])
    .eq('type', 'mock_exam')

  if (testError) throw new AppError('internal', 'Deneme sonuçları yüklenemedi.')

  const mockTests = new Map((testRows ?? []).map((row) => [row.id, row]))
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 3
  const mockSessions = sessions
    .filter((row) => mockTests.has(row.test_id) && row.finished_at !== null)
    .slice(0, safeLimit)

  if (mockSessions.length === 0) return []

  const divisors = await readDivisors(client, [
    ...new Set([...mockTests.values()].map((test) => test.exam_id)),
  ])

  const results: ParentMockResult[] = []
  for (const session of mockSessions) {
    const test = mockTests.get(session.test_id)
    const questionIds = (session.question_order ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )

    const sections = await buildSections(client, questionIds)
    const attempts = await readSessionAttempts(client, studentId, session.id)

    const summary = calculateMockSummary(sections, attempts, {
      divisor: (test?.exam_id ? divisors.get(test.exam_id) : undefined) ?? DEFAULT_DIVISOR,
    })

    results.push({
      sessionId: session.id,
      title: test?.title ?? '',
      finishedAt: session.finished_at as string,
      net: summary.net,
      correct: summary.correct,
      wrong: summary.wrong,
      blank: summary.blank,
      percentile: session.percentile === null ? null : Number(session.percentile),
      sections: summary.sections.map((entry) => ({
        subjectId: entry.subjectId,
        subjectName: entry.subjectName,
        correct: entry.correct,
        wrong: entry.wrong,
        blank: entry.blank,
        net: entry.net,
      })),
    })
  }

  return results
}

/* ------------------------------------------------------------------------- *
 * İç yardımcılar
 * ------------------------------------------------------------------------- */

async function readStudySeconds(
  client: Client,
  studentId: string,
  days: { start: string; end: string },
): Promise<number> {
  const { data, error } = await client
    .from('daily_activity')
    .select('study_seconds')
    .eq('user_id', studentId)
    .gte('date', days.start)
    .lte('date', days.end)

  if (error) throw new AppError('internal', 'Çalışma süresi yüklenemedi.')
  return (data ?? []).reduce((sum, row) => sum + (row.study_seconds ?? 0), 0)
}

async function readVideosCompleted(
  client: Client,
  studentId: string,
  instants: { from: string; to: string },
): Promise<number> {
  const { count, error } = await client
    .from('video_progress')
    .select('video_id', { count: 'exact', head: true })
    .eq('user_id', studentId)
    .gte('completed_at', instants.from)
    .lt('completed_at', instants.to)

  if (error) throw new AppError('internal', 'Video ilerlemesi yüklenemedi.')
  return count ?? 0
}

/**
 * Haftanın çözüm sayısı ve doğru sayısı.
 *
 * PostgREST toplama yüzeyi kapalı olduğu için satırlar sayfa sayfa okunup
 * bellekte sayılır — `lib/cron/reminders` ile aynı desen.
 */
async function readAnswerCounts(
  client: Client,
  studentId: string,
  instants: { from: string; to: string },
): Promise<{ total: number; correct: number }> {
  let from = 0
  let total = 0
  let correct = 0

  for (;;) {
    const { data, error } = await client
      .from('attempts')
      .select('is_correct, answered_at')
      .eq('user_id', studentId)
      .gte('answered_at', instants.from)
      .lt('answered_at', instants.to)
      .order('answered_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new AppError('internal', 'Çözüm istatistikleri yüklenemedi.')

    const rows = data ?? []
    total += rows.length
    for (const row of rows) {
      if (row.is_correct) correct += 1
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return { total, correct }
}

async function readBlockCounts(
  client: Client,
  studentId: string,
  days: { start: string; end: string },
): Promise<{ planned: number; completed: number }> {
  const { data, error } = await client
    .from('study_blocks')
    .select('id, completed_at')
    .eq('user_id', studentId)
    .gte('scheduled_date', days.start)
    .lte('scheduled_date', days.end)

  if (error) throw new AppError('internal', 'Program blokları yüklenemedi.')

  const rows = data ?? []
  return {
    planned: rows.length,
    completed: rows.filter((row) => row.completed_at !== null).length,
  }
}

/** Sınav başına yanlış katsayısı (`exams.wrong_penalty_divisor`). */
async function readDivisors(
  client: Client,
  examIds: ReadonlyArray<string | null>,
): Promise<Map<string, WrongPenaltyDivisor>> {
  const ids = examIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  const map = new Map<string, WrongPenaltyDivisor>()
  if (ids.length === 0) return map

  const { data, error } = await client
    .from('exams')
    .select('id, wrong_penalty_divisor')
    .in('id', ids)

  if (error) throw new AppError('internal', 'Sınav bilgisi yüklenemedi.')

  for (const row of data ?? []) {
    map.set(row.id, row.wrong_penalty_divisor === 3 ? 3 : 4)
  }
  return map
}

/**
 * Denemenin sorularını ders bölümlerine ayırır.
 *
 * Konu → ünite → ders zinciri üç düz sorguyla kurulur. Dersi çözülemeyen soru
 * atılmaz, "Diğer" bölümüne düşer: toplam net soru sayısıyla tutarlı kalmalı.
 */
async function buildSections(client: Client, questionIds: string[]): Promise<MockSectionInput[]> {
  if (questionIds.length === 0) return []

  const { data: questionRows, error } = await client
    .from('questions_public')
    .select('id, topic_id')
    .in('id', questionIds)

  if (error) throw new AppError('internal', 'Deneme soruları yüklenemedi.')

  const topicByQuestion = new Map<string, string>()
  for (const row of questionRows ?? []) {
    if (row.id && row.topic_id) topicByQuestion.set(row.id, row.topic_id)
  }

  const { data: topicRows, error: topicError } = await client
    .from('topics')
    .select('id, unit_id')
    .in('id', [...new Set(topicByQuestion.values())])

  if (topicError) throw new AppError('internal', 'Deneme konuları yüklenemedi.')
  const unitByTopic = new Map((topicRows ?? []).map((row) => [row.id, row.unit_id]))

  const { data: unitRows, error: unitError } = await client
    .from('units')
    .select('id, subject_id')
    .in('id', [...new Set(unitByTopic.values())])

  if (unitError) throw new AppError('internal', 'Deneme üniteleri yüklenemedi.')
  const subjectByUnit = new Map((unitRows ?? []).map((row) => [row.id, row.subject_id]))

  const { data: subjectRows, error: subjectError } = await client
    .from('subjects')
    .select('id, name, order_index')
    .in('id', [...new Set(subjectByUnit.values())])

  if (subjectError) throw new AppError('internal', 'Deneme dersleri yüklenemedi.')
  const subjects = new Map((subjectRows ?? []).map((row) => [row.id, row]))

  const sections = new Map<string, MockSectionInput & { orderIndex: number }>()

  for (const questionId of questionIds) {
    const topicId = topicByQuestion.get(questionId)
    const unitId = topicId ? unitByTopic.get(topicId) : undefined
    const subjectId = unitId ? subjectByUnit.get(unitId) : undefined
    const subject = subjectId ? subjects.get(subjectId) : undefined

    const key = subject?.id ?? 'diger'
    let section = sections.get(key)
    if (!section) {
      section = {
        subjectId: key,
        subjectName: subject?.name ?? 'Diğer',
        questionIds: [],
        orderIndex: subject?.order_index ?? Number.MAX_SAFE_INTEGER,
      }
      sections.set(key, section)
    }
    section.questionIds.push(questionId)
  }

  return [...sections.values()]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(({ subjectId, subjectName, questionIds: ids }) => ({
      subjectId,
      subjectName,
      questionIds: ids,
    }))
}

/** Oturumun cevapları. Boş bırakılan soru satır üretmez; core bunu boş sayar. */
async function readSessionAttempts(
  client: Client,
  studentId: string,
  sessionId: string,
): Promise<MockAttemptInput[]> {
  const { data, error } = await client
    .from('attempts')
    .select('question_id, topic_id, selected_option, is_correct')
    .eq('user_id', studentId)
    .eq('test_session_id', sessionId)
    .order('answered_at', { ascending: true })

  if (error) throw new AppError('internal', 'Deneme cevapları yüklenemedi.')

  return (data ?? []).map((row) => ({
    questionId: row.question_id,
    topicId: row.topic_id,
    selectedOption: row.selected_option,
    isCorrect: row.is_correct,
  }))
}
