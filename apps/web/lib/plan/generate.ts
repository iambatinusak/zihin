import 'server-only'

import { generateStudyPlan } from '@zihin/core'
import type { MasteryEntry, PlanTemplate, StudyBlockDraft, TopicLike } from '@zihin/core'
import { AppError } from '@/lib/errors'
import { getMasteryMap } from '@/lib/data/mastery'
import type { DataClient } from '@/lib/data/client'
import {
  mergeWithPreserved,
  resolveBlockContent,
  selectTestByTopic,
  selectVideoByTopic,
  type PreservedBlock,
  type TestCandidate,
  type VideoCandidate,
} from './blocks'
import { addDaysIso, diffDays, todayIso, toTurkeyDate, weekStartOf, weekStartOfIso } from './week'

/**
 * Haftalık çalışma programı üretimi (spec §M8).
 *
 * ALGORİTMA BURADA DEĞİL: bloklara karar veren `generateStudyPlan`
 * (`@zihin/core`). Bu dosyanın işi üç adım — veriyi toplamak, core'u çağırmak,
 * sonucu kalıcı hâle getirmek.
 *
 * Kalıcılaştırmanın üç kuralı:
 *  1. **Tamamlanmış bloklar korunur.** Eski planın tamamlanmış blokları
 *     SİLİNMEZ, yeni plana TAŞINIR (`plan_id` güncellenir). Kimlikleri
 *     değişmediği için verilmiş XP (`xp_events.ref_id`) ve `completed_at`
 *     damgası olduğu gibi kalır; kopyalasaydık aynı iş için ikinci bir XP
 *     kaydı mümkün olurdu.
 *  2. **Geçmiş silinmez.** Önceki plan `is_active = false` yapılır. Kısmi
 *     tekil indeks (idx_study_plans_active_week) hafta başına tek aktif plan
 *     bırakır, bu yüzden yenisini yazmadan ÖNCE eskisi pasifleştirilir.
 *  3. **İçeriği olmayan konu da programlanır.** 1164 konunun yalnızca birkaçı
 *     video/test taşıyor; içeriksiz konuyu atlamak programı boşaltırdı. Blok
 *     `video_id`/`test_id` alanları null kalır, arayüz onu "içerik hazırlanıyor"
 *     olarak gösterir (bkz. components/program/block-card.tsx).
 *
 * Yalnızca service-role istemcisiyle çağrılır: cron'un kullanıcı bağlamı yok
 * (CONVENTIONS §4). `userId` her zaman sunucuda doğrulanmış bir kimliktir.
 */

/** Hedef sınav tarihi yoksa varsayılan ufuk (gün). */
const DEFAULT_HORIZON_DAYS = 180

/** Tek insert çağrısındaki blok sayısı. */
const INSERT_CHUNK = 500

const TEMPLATES: readonly PlanTemplate[] = ['balanced', 'video_only', 'test_only', 'last_30_days']

const WARNING_NO_EXAM_DATE =
  'Hedef sınav tarihi belirlenmemiş; program varsayılan bir hedefe göre üretildi. Ayarlardan güncelleyebilirsiniz.'

export type GenerateOptions = {
  /** Üretilecek haftanın Pazartesi'si. Verilmezse içinde bulunulan hafta. */
  weekStart?: string
  /** Referans an — testler ve cron için dışarıdan verilebilir. */
  now?: Date
}

export type GenerateOutcome =
  | {
      status: 'generated'
      planId: string
      weekStart: string
      template: PlanTemplate
      blockCount: number
      preservedCount: number
      warnings: string[]
    }
  | { status: 'skipped'; reason: 'no_exam' }

type PlanProfile = {
  examId: string | null
  targetExamDate: string | null
  dailyMinutes: number
  studyDays: number[]
}

export async function generatePlanForUser(
  admin: DataClient,
  userId: string,
  /**
   * Şablon verilmezse kullanıcının EN SON kullandığı şablon sürdürülür.
   * Cron her hafta 'balanced'a düşürseydi, "Sadece test" seçen öğrencinin
   * tercihi pazar gecesi sessizce silinirdi.
   */
  template?: PlanTemplate,
  options: GenerateOptions = {},
): Promise<GenerateOutcome> {
  const now = options.now ?? new Date()
  const weekStart = options.weekStart ? weekStartOfIso(options.weekStart) : weekStartOf(now)

  const profile = await loadProfile(admin, userId)
  if (!profile.examId) return { status: 'skipped', reason: 'no_exam' }

  const effectiveTemplate = template ?? (await lastUsedTemplate(admin, userId))

  // Geçmiş günlere blok yazılmaz: içinde bulunulan hafta yenilenirken program
  // bugünden başlar, önceki günlerde yalnızca korunan bloklar kalır.
  const today = todayIso(now)
  const startDate = diffDays(today, weekStart) > 0 ? today : weekStart

  const extraWarnings: string[] = []
  const examDate = profile.targetExamDate ?? addDaysIso(weekStart, DEFAULT_HORIZON_DAYS)
  if (!profile.targetExamDate) extraWarnings.push(WARNING_NO_EXAM_DATE)

  const { topics, masteries } = await loadTopicsAndMasteries(admin, userId, profile.examId)

  const result = generateStudyPlan({
    startDate: toTurkeyDate(startDate),
    examDate: toTurkeyDate(examDate),
    dailyMinutes: profile.dailyMinutes,
    studyDays: profile.studyDays,
    topics,
    masteries,
    template: effectiveTemplate,
    weeks: 1,
  })

  const previous = await getActivePlanId(admin, userId, weekStart)
  const preserved = previous ? await loadCompletedBlocks(admin, userId, previous) : []

  const merged = mergeWithPreserved(result.blocks, preserved)
  const contentDrafts = await attachContent(admin, merged.drafts)

  // Sıra önemli: tekil indeks hafta başına tek aktif plana izin verir.
  if (previous) await deactivatePlan(admin, previous)

  const warnings = [...result.warnings, ...extraWarnings]
  const planId = await insertPlan(admin, {
    userId,
    weekStart,
    template: effectiveTemplate,
    warnings,
    stats: {
      ...result.stats,
      blockCount: merged.drafts.length + preserved.length,
      preservedCount: preserved.length,
    },
  })

  if (preserved.length > 0) await movePreservedBlocks(admin, preserved, planId)
  await insertBlocks(admin, userId, planId, contentDrafts)

  return {
    status: 'generated',
    planId,
    weekStart,
    template: effectiveTemplate,
    blockCount: merged.drafts.length + preserved.length,
    preservedCount: preserved.length,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Veri toplama
// ---------------------------------------------------------------------------

async function loadProfile(admin: DataClient, userId: string): Promise<PlanProfile> {
  const { data, error } = await admin
    .from('profiles')
    .select('exam_id, target_exam_date, daily_minutes, study_days')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Profil bilgisi okunamadı.')
  if (!data) throw new AppError('not_found', 'Profil bulunamadı.')

  const studyDays = Array.isArray(data.study_days) ? data.study_days : []

  return {
    examId: data.exam_id,
    targetExamDate: data.target_exam_date,
    dailyMinutes: data.daily_minutes ?? 60,
    studyDays: studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5, 6],
  }
}

/**
 * Konu listesi ve yetkinlikler, yetkinlik panelinin okuduğu ağacın aynısından
 * türetilir (`getMasteryMap`). Müfredat sorgusu böylece tek yerde kalır ve
 * ölçülmemiş konu da listede durur (nötr 35 / unknown).
 */
async function loadTopicsAndMasteries(
  admin: DataClient,
  userId: string,
  examId: string,
): Promise<{ topics: TopicLike[]; masteries: MasteryEntry[] }> {
  const map = await getMasteryMap(admin, userId, examId)

  const topics: TopicLike[] = []
  const masteries: MasteryEntry[] = []

  for (const subject of map.subjects) {
    for (const unit of subject.units) {
      for (const topic of unit.topics) {
        topics.push({
          id: topic.topicId,
          subjectId: subject.subjectId,
          unitId: unit.unitId,
          title: topic.title,
          orderIndex: topic.orderIndex,
          estimatedMinutes: topic.estimatedMinutes,
          difficulty: topic.difficulty,
          examWeight: topic.examWeight,
        })
        // Ölçülmemiş konu core'a GÖNDERİLMEZ: `classifyTopic` kayıt yokluğunu
        // 'unknown' sayar, nötr 35 puanı "orta" gibi sıralanmasına yol açardı.
        if (topic.status !== 'unknown') {
          masteries.push({
            topicId: topic.topicId,
            mastery: topic.mastery,
            status: topic.status,
            attemptsCount: topic.attemptsCount,
          })
        }
      }
    }
  }

  return { topics, masteries }
}

/** Kullanıcının en son ürettiği planın şablonu; hiç planı yoksa 'balanced'. */
async function lastUsedTemplate(admin: DataClient, userId: string): Promise<PlanTemplate> {
  const { data, error } = await admin
    .from('study_plans')
    .select('template')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(1)

  if (error) throw new AppError('internal', 'Önceki program okunamadı.')
  const value = (data ?? [])[0]?.template
  return TEMPLATES.includes(value as PlanTemplate) ? (value as PlanTemplate) : 'balanced'
}

async function getActivePlanId(
  admin: DataClient,
  userId: string,
  weekStart: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('study_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Önceki program okunamadı.')
  return data?.id ?? null
}

async function loadCompletedBlocks(
  admin: DataClient,
  userId: string,
  planId: string,
): Promise<PreservedBlock[]> {
  const { data, error } = await admin
    .from('study_blocks')
    .select('id, scheduled_date, order_index, type, topic_id')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .not('completed_at', 'is', null)

  if (error) throw new AppError('internal', 'Tamamlanmış bloklar okunamadı.')

  return (data ?? []).map((row) => ({
    id: row.id,
    scheduledDate: row.scheduled_date,
    orderIndex: row.order_index,
    type: row.type as PreservedBlock['type'],
    topicId: row.topic_id,
  }))
}

type ContentDraft = StudyBlockDraft & { videoId: string | null; testId: string | null }

/** Taslakların konularına yayımlanmış video/test bağlar. İki düz sorgu. */
async function attachContent(
  admin: DataClient,
  drafts: readonly StudyBlockDraft[],
): Promise<ContentDraft[]> {
  const topicIds = [
    ...new Set(drafts.map((draft) => draft.topicId).filter((id): id is string => id !== null)),
  ]

  if (topicIds.length === 0) {
    return drafts.map((draft) => ({ ...draft, videoId: null, testId: null }))
  }

  const { data: videos, error: videoError } = await admin
    .from('videos')
    .select('id, topic_id, type, order_index')
    .in('topic_id', topicIds)
    .eq('is_published', true)
    .is('deleted_at', null)

  if (videoError) throw new AppError('internal', 'Video içeriği okunamadı.')

  const { data: tests, error: testError } = await admin
    .from('tests')
    .select('id, topic_id, type')
    .in('topic_id', topicIds)
    .eq('is_published', true)
    .is('deleted_at', null)

  if (testError) throw new AppError('internal', 'Test içeriği okunamadı.')

  const videoCandidates: VideoCandidate[] = (videos ?? []).map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    type: row.type,
    orderIndex: row.order_index,
  }))
  const testCandidates: TestCandidate[] = (tests ?? [])
    .filter((row): row is typeof row & { topic_id: string } => row.topic_id !== null)
    .map((row) => ({ id: row.id, topicId: row.topic_id, type: row.type }))

  const videoByTopic = selectVideoByTopic(videoCandidates)
  const testByTopic = selectTestByTopic(testCandidates)

  return drafts.map((draft) => ({
    ...draft,
    ...resolveBlockContent(draft.type, draft.topicId, videoByTopic, testByTopic),
  }))
}

// ---------------------------------------------------------------------------
// Yazma
// ---------------------------------------------------------------------------

async function deactivatePlan(admin: DataClient, planId: string): Promise<void> {
  const { error } = await admin.from('study_plans').update({ is_active: false }).eq('id', planId)
  if (error) throw new AppError('internal', 'Önceki program arşivlenemedi.')
}

async function insertPlan(
  admin: DataClient,
  input: {
    userId: string
    weekStart: string
    template: PlanTemplate
    warnings: string[]
    stats: Record<string, number>
  },
): Promise<string> {
  const { data, error } = await admin
    .from('study_plans')
    .insert({
      user_id: input.userId,
      week_start: input.weekStart,
      template: input.template,
      warnings: input.warnings,
      stats: input.stats,
      generated_at: new Date().toISOString(),
      is_active: true,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) throw new AppError('internal', 'Program kaydedilemedi.')
  return data.id
}

/** Tamamlanmış blokları yeni plana taşır; kimlikleri korunur (bkz. kural 1). */
async function movePreservedBlocks(
  admin: DataClient,
  preserved: readonly PreservedBlock[],
  planId: string,
): Promise<void> {
  const { error } = await admin
    .from('study_blocks')
    .update({ plan_id: planId })
    .in(
      'id',
      preserved.map((block) => block.id),
    )

  if (error) throw new AppError('internal', 'Tamamlanmış bloklar taşınamadı.')
}

async function insertBlocks(
  admin: DataClient,
  userId: string,
  planId: string,
  drafts: readonly ContentDraft[],
): Promise<void> {
  if (drafts.length === 0) return

  const rows = drafts.map((draft) => ({
    plan_id: planId,
    user_id: userId,
    scheduled_date: draft.scheduledDate,
    order_index: draft.orderIndex,
    type: draft.type,
    topic_id: draft.topicId,
    video_id: draft.videoId,
    test_id: draft.testId,
    title: draft.title,
    // Şema 1-600 arası ister; core 0 dakikalık blok üretebilir (süresi
    // girilmemiş konu), o yüzden taban 1'e çekilir.
    estimated_minutes: Math.min(600, Math.max(1, Math.round(draft.estimatedMinutes))),
  }))

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await admin.from('study_blocks').insert(rows.slice(i, i + INSERT_CHUNK))
    if (error) throw new AppError('internal', 'Program blokları kaydedilemedi.')
  }
}
