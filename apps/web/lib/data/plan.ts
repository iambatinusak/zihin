import 'server-only'

import type { PlanTemplate, StudyBlockType } from '@zihin/core'
import { AppError } from '@/lib/errors'
import { compareBlocksForDisplay } from '@/lib/plan/blocks'
import { weekStartOfIso } from '@/lib/plan/week'
import { getTopicLabels } from './topic-labels'
import type { DataClient } from './client'

/**
 * Çalışma programı okumaları. Yazma yolu ayrıdır:
 * `lib/plan/generate.ts` (service-role) ve `app/(student)/program/actions.ts`.
 *
 * Buradaki sorgular normal oturum istemcisiyle çalışır: `study_plans` ve
 * `study_blocks` kullanıcının kendi satırlarına RLS ile okuma izni verir
 * (0011_rls_policies.sql, veli de okuyabilir).
 *
 * DEĞİŞMEZ KURAL: bloklar HER ZAMAN aktif planın kimliğiyle okunur, yalnızca
 * `user_id + scheduled_date` ile değil. Yeniden üretimde eski plan silinmez,
 * `is_active = false` yapılır; tamamlanmamış blokları o planda kalır. Tarihe
 * göre okumak bu arşiv satırlarını da ekrana getirirdi.
 */

export type PlanStats = {
  topicCount: number
  totalMinutes: number
  weeklyBudgetMinutes: number
  weeksRemaining: number
  blockCount: number
  preservedCount: number
}

export type StudyPlanRow = {
  id: string
  userId: string
  /** Planın kapsadığı haftanın Pazartesi'si (YYYY-MM-DD). */
  weekStart: string
  template: PlanTemplate
  warnings: string[]
  stats: PlanStats
  generatedAt: string
  isActive: boolean
}

/** Bloğun bağlı olduğu konunun okunur etiketi ve bağlantı parçaları. */
export type BlockTopic = {
  id: string
  title: string
  slug: string
  unitSlug: string
  subjectSlug: string
  subjectName: string
}

export type StudyBlockItem = {
  id: string
  planId: string
  scheduledDate: string
  orderIndex: number
  type: StudyBlockType
  title: string
  estimatedMinutes: number
  topicId: string | null
  /** Konunun videosu varsa oynatıcı kimliği; yoksa null (içerik henüz yok). */
  videoId: string | null
  /** Konunun testi varsa test kimliği; yoksa null. */
  testId: string | null
  completedAt: string | null
  /** Blok taşındıysa özgün gün; hiç taşınmadıysa null. */
  movedFromDate: string | null
  topic: BlockTopic | null
}

export type WeekPlan = {
  weekStart: string
  plan: StudyPlanRow | null
  blocks: StudyBlockItem[]
}

const PLAN_COLUMNS = 'id, user_id, week_start, template, warnings, stats, generated_at, is_active'
const BLOCK_COLUMNS =
  'id, plan_id, scheduled_date, order_index, type, title, estimated_minutes, topic_id, video_id, test_id, completed_at, moved_from_date'

const TEMPLATES: readonly PlanTemplate[] = ['balanced', 'video_only', 'test_only', 'last_30_days']

/** Bir haftanın aktif planı. Yoksa null — çağıran "program yok" durumunu gösterir. */
export async function getActivePlan(
  client: DataClient,
  userId: string,
  weekStart: string,
): Promise<StudyPlanRow | null> {
  const { data, error } = await client
    .from('study_plans')
    .select(PLAN_COLUMNS)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Çalışma programı yüklenemedi.')
  return data ? toPlanRow(data as PlanRecord) : null
}

/** En son üretilmiş aktif plan — hangi haftaya bakılacağı bilinmiyorsa. */
export async function getLatestActivePlan(
  client: DataClient,
  userId: string,
): Promise<StudyPlanRow | null> {
  const { data, error } = await client
    .from('study_plans')
    .select(PLAN_COLUMNS)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('week_start', { ascending: false })
    .limit(1)

  if (error) throw new AppError('internal', 'Çalışma programı yüklenemedi.')
  const row = (data ?? [])[0]
  return row ? toPlanRow(row as PlanRecord) : null
}

/** Bir planın blokları, gün ve sıra düzeninde. */
export async function getPlanBlocks(
  client: DataClient,
  userId: string,
  planId: string,
): Promise<StudyBlockItem[]> {
  const { data, error } = await client
    .from('study_blocks')
    .select(BLOCK_COLUMNS)
    // user_id filtresi RLS'in üstüne konur: yetki iki kez denetlenir
    // (CONVENTIONS §3) ve sorgu idx_study_blocks_user_date'i kullanır.
    .eq('user_id', userId)
    .eq('plan_id', planId)

  if (error) throw new AppError('internal', 'Program blokları yüklenemedi.')

  const rows = (data ?? []) as BlockRecord[]
  const labels = await getTopicLabels(
    client,
    rows.map((row) => row.topic_id).filter((id): id is string => id !== null),
  )

  return rows
    .map((row) => toBlockItem(row, labels))
    .sort((a, b) =>
      a.scheduledDate === b.scheduledDate
        ? compareBlocksForDisplay(a, b)
        : a.scheduledDate < b.scheduledDate
          ? -1
          : 1,
    )
}

/** Bir haftanın planı ve blokları tek çağrıda. */
export async function getWeekPlan(
  client: DataClient,
  userId: string,
  weekStart: string,
): Promise<WeekPlan> {
  const plan = await getActivePlan(client, userId, weekStart)
  if (!plan) return { weekStart, plan: null, blocks: [] }
  return { weekStart, plan, blocks: await getPlanBlocks(client, userId, plan.id) }
}

/**
 * "Bugün" panelinin veri kaynağı. Günün haftasının aktif planı okunur, sonra
 * o günün blokları süzülür — arşivlenmiş planların blokları görünmesin diye
 * (bkz. dosya başındaki değişmez kural).
 */
export async function getBlocksForDate(
  client: DataClient,
  userId: string,
  date: string,
): Promise<{ plan: StudyPlanRow | null; blocks: StudyBlockItem[] }> {
  const plan = await getActivePlan(client, userId, weekStartOfIso(date))
  if (!plan) return { plan: null, blocks: [] }
  const blocks = await getPlanBlocks(client, userId, plan.id)
  return { plan, blocks: blocks.filter((block) => block.scheduledDate === date) }
}

export type OwnedBlock = {
  id: string
  planId: string
  userId: string
  scheduledDate: string
  orderIndex: number
  completedAt: string | null
  movedFromDate: string | null
  type: StudyBlockType
  /** Planlanan süre (dakika); günlük çalışma sayacına bu değer yazılır. */
  estimatedMinutes: number
}

/**
 * Sahiplik denetimiyle tek blok. `user_id` eşitliği sorgunun içindedir:
 * bulunamayan blok ile başkasının bloğu çağırana aynı şekilde görünür, böylece
 * kimlik denemesiyle varlık sızdırılmaz.
 */
export async function getOwnedBlock(
  client: DataClient,
  userId: string,
  blockId: string,
): Promise<OwnedBlock | null> {
  const { data, error } = await client
    .from('study_blocks')
    .select(
      'id, plan_id, user_id, scheduled_date, order_index, completed_at, moved_from_date, type, estimated_minutes',
    )
    .eq('id', blockId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Program bloğu yüklenemedi.')
  if (!data) return null

  return {
    id: data.id,
    planId: data.plan_id,
    userId: data.user_id,
    scheduledDate: data.scheduled_date,
    orderIndex: data.order_index,
    completedAt: data.completed_at,
    movedFromDate: data.moved_from_date,
    type: data.type as StudyBlockType,
    estimatedMinutes: data.estimated_minutes ?? 0,
  }
}

/** Bir gündeki en büyük sıra numarası. Taşınan blok günün sonuna eklenir. */
export async function getMaxOrderIndex(
  client: DataClient,
  userId: string,
  planId: string,
  date: string,
): Promise<number> {
  const { data, error } = await client
    .from('study_blocks')
    .select('order_index')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('scheduled_date', date)
    .order('order_index', { ascending: false })
    .limit(1)

  if (error) throw new AppError('internal', 'Program bloğu taşınamadı.')
  return (data ?? [])[0]?.order_index ?? -1
}

// ---------------------------------------------------------------------------
// Satır → tip dönüşümleri
// ---------------------------------------------------------------------------

type PlanRecord = {
  id: string
  user_id: string
  week_start: string
  template: string
  warnings: string[] | null
  stats: unknown
  generated_at: string
  is_active: boolean
}

type BlockRecord = {
  id: string
  plan_id: string
  scheduled_date: string
  order_index: number
  type: string
  title: string
  estimated_minutes: number
  topic_id: string | null
  video_id: string | null
  test_id: string | null
  completed_at: string | null
  moved_from_date: string | null
}

function toPlanRow(row: PlanRecord): StudyPlanRow {
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: row.week_start,
    template: toTemplate(row.template),
    warnings: Array.isArray(row.warnings) ? row.warnings.filter(isNonEmptyString) : [],
    stats: toStats(row.stats),
    generatedAt: row.generated_at,
    isActive: row.is_active,
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function toTemplate(value: string): PlanTemplate {
  return TEMPLATES.includes(value as PlanTemplate) ? (value as PlanTemplate) : 'balanced'
}

/** `stats` şeması serbest bir jsonb; okuma tarafı hiçbir alana güvenmez. */
function toStats(value: unknown): PlanStats {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const num = (key: string): number => {
    const raw = source[key]
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
  }
  return {
    topicCount: num('topicCount'),
    totalMinutes: num('totalMinutes'),
    weeklyBudgetMinutes: num('weeklyBudgetMinutes'),
    weeksRemaining: num('weeksRemaining'),
    blockCount: num('blockCount'),
    preservedCount: num('preservedCount'),
  }
}

function toBlockItem(
  row: BlockRecord,
  labels: Map<
    string,
    {
      topicTitle: string
      topicSlug: string
      unitSlug: string
      subjectSlug: string
      subjectName: string
    }
  >,
): StudyBlockItem {
  const label = row.topic_id ? labels.get(row.topic_id) : undefined

  return {
    id: row.id,
    planId: row.plan_id,
    scheduledDate: row.scheduled_date,
    orderIndex: row.order_index,
    type: row.type as StudyBlockType,
    title: row.title,
    estimatedMinutes: row.estimated_minutes,
    topicId: row.topic_id,
    videoId: row.video_id,
    testId: row.test_id,
    completedAt: row.completed_at,
    movedFromDate: row.moved_from_date,
    topic:
      label && row.topic_id
        ? {
            id: row.topic_id,
            title: label.topicTitle,
            slug: label.topicSlug,
            unitSlug: label.unitSlug,
            subjectSlug: label.subjectSlug,
            subjectName: label.subjectName,
          }
        : null,
  }
}
