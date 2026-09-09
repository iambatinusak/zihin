import 'server-only'

import { rankPriorityTopics } from '@zihin/core'
import type { MasteryEntry, MasteryStatus, PriorityTopic, TopicLike } from '@zihin/core'
import { AppError } from '@/lib/errors'
import { timelineSince, toWeeklyAverages, type MasteryTimelinePoint } from '@/lib/mastery/timeline'
import type { DataClient } from './client'

/**
 * Yetkinlik okumaları — panel, gösterge paneli ve çalışma programı bu dosyayı
 * paylaşır. Yazma yolu ayrıdır (`lib/mastery/recalculate.ts`, service-role).
 *
 * Buradaki sorgular normal oturum istemcisiyle de çalışır: `topic_mastery` ve
 * `mastery_history` kullanıcının kendi satırlarına RLS ile okuma izni verir.
 * Müfredat tabloları herkese açıktır.
 *
 * Kayıt bulunmayan konu listeden DÜŞMEZ: core'un nötr önseliyle (35 / unknown)
 * gösterilir — hiç dokunulmamış konu da çalışma listesinde görünmeli.
 */

/** Yetkinlik kaydı olmayan konu için nötr başlangıç (şema varsayılanıyla aynı). */
export const NEUTRAL_MASTERY = 35

export type MasteryTopicEntry = {
  topicId: string
  title: string
  slug: string
  orderIndex: number
  estimatedMinutes: number
  difficulty: number
  examWeight: number
  mastery: number
  status: MasteryStatus
  attemptsCount: number
  /** Kayıt yoksa null — "hiç ölçülmedi" ile "ölçüldü ama veri az" ayrımı için. */
  lastCalculatedAt: string | null
}

export type MasteryUnitGroup = {
  unitId: string
  name: string
  orderIndex: number
  topics: MasteryTopicEntry[]
  /** Ünitedeki konuların yetkinlik ortalaması (0-100). */
  averageMastery: number
}

export type MasterySubjectGroup = {
  subjectId: string
  name: string
  slug: string
  orderIndex: number
  color: string | null
  units: MasteryUnitGroup[]
  topicCount: number
  averageMastery: number
}

export type MasteryMap = {
  subjects: MasterySubjectGroup[]
  topicCount: number
  /** En az bir kez ölçülmüş (status !== 'unknown') konu sayısı. */
  measuredTopicCount: number
  averageMastery: number
}

export type SubjectAverage = {
  subjectId: string
  name: string
  color: string | null
  orderIndex: number
  averageMastery: number
  topicCount: number
  measuredTopicCount: number
}

type CurriculumRow = {
  topic: TopicLike & { title: string; slug: string }
  subject: { id: string; name: string; slug: string; orderIndex: number; color: string | null }
  unit: { id: string; name: string; orderIndex: number }
}

type MasteryRow = {
  mastery: number
  status: MasteryStatus
  attemptsCount: number
  lastCalculatedAt: string
}

/**
 * Sınavın TÜM konularını, kullanıcının yetkinlik satırıyla eşleyip
 * ders → ünite ağacında gruplar. Kayıt yoksa nötr varsayılan kullanılır.
 */
export async function getMasteryMap(
  client: DataClient,
  userId: string,
  examId: string,
): Promise<MasteryMap> {
  const curriculum = await loadCurriculum(client, examId)
  const masteries = await loadMasteryRows(
    client,
    userId,
    curriculum.map((row) => row.topic.id),
  )

  // Ders → ünite ağacı bellekte kurulur; sorgular düz kalır (CONVENTIONS §5).
  const subjects = new Map<string, MasterySubjectGroup>()
  const units = new Map<string, MasteryUnitGroup>()

  for (const row of curriculum) {
    let subject = subjects.get(row.subject.id)
    if (!subject) {
      subject = {
        subjectId: row.subject.id,
        name: row.subject.name,
        slug: row.subject.slug,
        orderIndex: row.subject.orderIndex,
        color: row.subject.color,
        units: [],
        topicCount: 0,
        averageMastery: 0,
      }
      subjects.set(row.subject.id, subject)
    }

    let unit = units.get(row.unit.id)
    if (!unit) {
      unit = {
        unitId: row.unit.id,
        name: row.unit.name,
        orderIndex: row.unit.orderIndex,
        topics: [],
        averageMastery: 0,
      }
      units.set(row.unit.id, unit)
      subject.units.push(unit)
    }

    unit.topics.push(toEntry(row, masteries.get(row.topic.id) ?? null))
  }

  let total = 0
  let measured = 0
  let count = 0

  const grouped = [...subjects.values()]
  for (const subject of grouped) {
    let subjectTotal = 0
    let subjectCount = 0
    for (const unit of subject.units) {
      unit.averageMastery = average(unit.topics.map((topic) => topic.mastery))
      subjectTotal += unit.topics.reduce((sum, topic) => sum + topic.mastery, 0)
      subjectCount += unit.topics.length
      measured += unit.topics.filter((topic) => topic.status !== 'unknown').length
    }
    subject.topicCount = subjectCount
    subject.averageMastery = subjectCount === 0 ? 0 : Math.round(subjectTotal / subjectCount)
    total += subjectTotal
    count += subjectCount
  }

  return {
    subjects: grouped,
    topicCount: count,
    measuredTopicCount: measured,
    averageMastery: count === 0 ? 0 : Math.round(total / count),
  }
}

/**
 * Öncelikli konular. Sıralamayı core yapar (`rankPriorityTopics`); buradaki iş
 * yalnızca veriyi toplamak ve ilk `n` taneyi kesmek.
 */
export async function getPriorityTopics(
  client: DataClient,
  userId: string,
  examId: string,
  n = 5,
): Promise<PriorityTopic[]> {
  const curriculum = await loadCurriculum(client, examId)
  if (curriculum.length === 0) return []

  const masteries = await loadMasteryRows(
    client,
    userId,
    curriculum.map((row) => row.topic.id),
  )

  const entries: MasteryEntry[] = []
  for (const [topicId, row] of masteries) {
    entries.push({
      topicId,
      mastery: row.mastery,
      status: row.status,
      attemptsCount: row.attemptsCount,
    })
  }

  const ranked = rankPriorityTopics(
    entries,
    curriculum.map((row) => row.topic),
  )
  const limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : 5
  return ranked.slice(0, limit)
}

/**
 * Gelişim grafiği: son `weeks` haftanın haftalık yetkinlik ortalaması.
 * Anlık görüntüleri cron yazar (`/api/cron/mastery-snapshot`).
 */
export async function getMasteryTimeline(
  client: DataClient,
  userId: string,
  weeks = 12,
  now: Date = new Date(),
): Promise<MasteryTimelinePoint[]> {
  const since = timelineSince(now, weeks)

  const { data, error } = await client
    .from('mastery_history')
    .select('mastery, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) throw new AppError('internal', 'Yetkinlik geçmişi yüklenemedi.')

  return toWeeklyAverages(
    (data ?? []).map((row) => ({ mastery: row.mastery, recordedAt: row.recorded_at })),
  )
}

/** Radar grafiği: ders başına yetkinlik ortalaması. */
export async function getSubjectAverages(
  client: DataClient,
  userId: string,
  examId: string,
): Promise<SubjectAverage[]> {
  const map = await getMasteryMap(client, userId, examId)

  return map.subjects.map((subject) => ({
    subjectId: subject.subjectId,
    name: subject.name,
    color: subject.color,
    orderIndex: subject.orderIndex,
    averageMastery: subject.averageMastery,
    topicCount: subject.topicCount,
    measuredTopicCount: subject.units.reduce(
      (sum, unit) => sum + unit.topics.filter((topic) => topic.status !== 'unknown').length,
      0,
    ),
  }))
}

// ---------------------------------------------------------------------------
// İç yardımcılar
// ---------------------------------------------------------------------------

function toEntry(row: CurriculumRow, mastery: MasteryRow | null): MasteryTopicEntry {
  return {
    topicId: row.topic.id,
    title: row.topic.title,
    slug: row.topic.slug,
    orderIndex: row.topic.orderIndex,
    estimatedMinutes: row.topic.estimatedMinutes,
    difficulty: row.topic.difficulty,
    examWeight: row.topic.examWeight,
    mastery: mastery?.mastery ?? NEUTRAL_MASTERY,
    status: mastery?.status ?? 'unknown',
    attemptsCount: mastery?.attemptsCount ?? 0,
    lastCalculatedAt: mastery?.lastCalculatedAt ?? null,
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

/**
 * Sınavın ders/ünite/konu ağacını üç düz sorguyla toplar. İç içe `select`
 * yerine düz sorgu: üretilen tiplerle birebir uyuşuyor ve testte sahtelemesi
 * kolay (CONVENTIONS §5).
 */
async function loadCurriculum(client: DataClient, examId: string): Promise<CurriculumRow[]> {
  const { data: subjects, error: subjectError } = await client
    .from('subjects')
    .select('id, name, slug, order_index, color')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (subjectError) throw new AppError('internal', 'Dersler yüklenemedi.')
  if (!subjects || subjects.length === 0) return []

  const { data: units, error: unitError } = await client
    .from('units')
    .select('id, subject_id, name, order_index')
    .in(
      'subject_id',
      subjects.map((subject) => subject.id),
    )
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (unitError) throw new AppError('internal', 'Üniteler yüklenemedi.')
  if (!units || units.length === 0) return []

  const { data: topics, error: topicError } = await client
    .from('topics')
    .select('id, unit_id, title, slug, order_index, estimated_minutes, difficulty, exam_weight')
    .in(
      'unit_id',
      units.map((unit) => unit.id),
    )
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (topicError) throw new AppError('internal', 'Konular yüklenemedi.')
  if (!topics) return []

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]))
  const unitById = new Map(units.map((unit) => [unit.id, unit]))

  const rows: CurriculumRow[] = []
  for (const topic of topics) {
    const unit = unitById.get(topic.unit_id)
    if (!unit) continue
    const subject = subjectById.get(unit.subject_id)
    if (!subject) continue

    rows.push({
      topic: {
        id: topic.id,
        subjectId: subject.id,
        unitId: unit.id,
        title: topic.title,
        slug: topic.slug,
        orderIndex: topic.order_index,
        estimatedMinutes: topic.estimated_minutes,
        difficulty: topic.difficulty,
        examWeight: Number(topic.exam_weight),
      },
      subject: {
        id: subject.id,
        name: subject.name,
        slug: subject.slug,
        orderIndex: subject.order_index,
        color: subject.color,
      },
      unit: { id: unit.id, name: unit.name, orderIndex: unit.order_index },
    })
  }
  return rows
}

/** Kullanıcının verilen konulardaki yetkinlik satırları. */
/**
 * Belirli konuların yetkinlik satırları. Sonuç ekranı testin dokunduğu 3-5
 * konuyu gösterir; bütün müfredat ağacını (`getMasteryMap`) kurmanın anlamı
 * yok. Kaydı olmayan konu haritada YER ALMAZ — çağıran "henüz ölçülmedi"
 * durumunu kendisi gösterir, uydurma bir puan basılmaz.
 */
export async function getTopicMasteries(
  client: DataClient,
  userId: string,
  topicIds: readonly string[],
): Promise<Map<string, MasteryRow>> {
  return loadMasteryRows(client, userId, [...new Set(topicIds)].filter(Boolean))
}

async function loadMasteryRows(
  client: DataClient,
  userId: string,
  topicIds: string[],
): Promise<Map<string, MasteryRow>> {
  const map = new Map<string, MasteryRow>()
  if (topicIds.length === 0) return map

  const { data, error } = await client
    .from('topic_mastery')
    .select('topic_id, mastery, status, attempts_count, last_calculated_at')
    .eq('user_id', userId)
    .in('topic_id', topicIds)

  if (error) throw new AppError('internal', 'Yetkinlik bilgisi yüklenemedi.')

  for (const row of data ?? []) {
    map.set(row.topic_id, {
      mastery: row.mastery,
      status: row.status,
      attemptsCount: row.attempts_count,
      lastCalculatedAt: row.last_calculated_at,
    })
  }
  return map
}
