/**
 * @zihin/core — kisisel haftalik calisma programi ureteci.
 *
 * Deterministiktir: ayni girdi her zaman ayni bloklari uretir. "Simdi" kavrami
 * yoktur; tum tarihler `PlanInput` uzerinden gelir.
 *
 * Gun hesabinin referansi Turkiye saatidir (UTC+3, yaz saati uygulanmaz).
 * Tarihler once bu ofsete gore tam sayi "gun numarasina" cevrilir; boylece
 * calisan makinenin saat dilimi cikti tarihini bir gun kaydiramaz.
 */

import type {
  MasteryEntry,
  PlanInput,
  PlanTemplate,
  StudyBlockDraft,
  StudyBlockType,
  StudyPlanResult,
  TopicLike,
} from './types'

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
/** Turkiye referans ofseti — yaz saati uygulanmadigi icin sabit. */
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000

const SOLVE_MINUTES = 15
const REVIEW_MINUTES = 5
const MOCK_MINUTES = 30
const MAX_SUBJECTS_PER_DAY = 3
/** Tekrar blogu izlemeden en az 2 gun sonra gelir (aralikli tekrar mantigi). */
const REVIEW_GAP_DAYS = 2

const MOCK_TITLE = 'Haftalık Mini Deneme'

const WARNING_EXAM_PASSED = 'Sınav tarihi geçmiş görünüyor. Ayarlardan güncelleyin.'
const WARNING_TIGHT = 'Program yoğun, günlük çalışma süresini artırmayı düşünün.'
const WARNING_STRONG_DROPPED = 'Zaman kısıtlı olduğu için güçlü konular programa alınmadı.'
const WARNING_NO_STUDY_DAYS = 'Çalışma günü seçilmedi, program oluşturulamadı.'
const WARNING_OVERSIZED =
  'Bazı konular günlük sürenize sığmıyor; günlük çalışma süresini artırmayı düşünün.'

/** Her sablonun uretebilecegi blok tipleri (haftalik deneme her sablonda vardir). */
const TEMPLATE_TYPES: Record<PlanTemplate, readonly StudyBlockType[]> = {
  balanced: ['watch', 'solve', 'review'],
  video_only: ['watch'],
  test_only: ['solve'],
  last_30_days: ['solve', 'review'],
}

// ---------------------------------------------------------------------------
// Ic tipler
// ---------------------------------------------------------------------------

type TopicCategory = 'weak' | 'unknown' | 'medium' | 'strong'

type Candidate = {
  topic: TopicLike
  category: TopicCategory
  priority: number
}

type PlannedBlock = {
  type: StudyBlockType
  topicId: string | null
  minutes: number
  title: string
}

type DaySlot = {
  dayNumber: number
  weekIndex: number
  remainingMinutes: number
  subjects: Set<string>
  blocks: PlannedBlock[]
  /** Gunluk butceyi tek basina asan blok gunu kilitler. */
  locked: boolean
  isMockDay: boolean
}

type PackContext = {
  days: DaySlot[]
  dailyMinutes: number
  oversizedSeen: boolean
  tight: boolean
}

// ---------------------------------------------------------------------------
// Tarih yardimcilari
// ---------------------------------------------------------------------------

/** Turkiye saatine gore gun numarasi (1970-01-01 = 0). */
function toDayNumber(date: Date): number {
  return Math.floor((date.getTime() + TURKEY_OFFSET_MS) / DAY_MS)
}

/** ISO hafta gunu: 1 = Pazartesi ... 7 = Pazar. */
function isoWeekday(dayNumber: number): number {
  // 1970-01-01 Persembe oldugu icin +3 kaydiriliyor; negatif gunlerde de
  // dogru calissin diye mod iki kez uygulanir.
  return ((((dayNumber + 3) % 7) + 7) % 7) + 1
}

function mondayOfWeek(dayNumber: number): number {
  return dayNumber - (isoWeekday(dayNumber) - 1)
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

/** Gun numarasini "YYYY-MM-DD" formatina cevirir (UTC parcalarindan). */
function formatDayNumber(dayNumber: number): string {
  const date = new Date(dayNumber * DAY_MS)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

// ---------------------------------------------------------------------------
// Konu siralama
// ---------------------------------------------------------------------------

function normalizeStudyDays(days: number[]): number[] {
  const unique = new Set<number>()
  for (const day of days) {
    if (Number.isInteger(day) && day >= 1 && day <= 7) unique.add(day)
  }
  return [...unique].sort((a, b) => a - b)
}

function classifyTopic(entry: MasteryEntry | undefined, mastery: number): TopicCategory {
  // Veri yetersizse (n < 3) statu 'unknown' gelir; bu, yetkinlik sayisindan
  // turetilemeyecegi icin oncelikle kontrol edilir.
  if (!entry || entry.status === 'unknown') return 'unknown'
  if (mastery < 50) return 'weak'
  if (mastery < 75) return 'medium'
  return 'strong'
}

function computePriority(mastery: number, topic: TopicLike): number {
  return (100 - mastery) * topic.examWeight * (1 + 0.2 * topic.difficulty)
}

function compareById(a: Candidate, b: Candidate): number {
  if (a.topic.id === b.topic.id) return 0
  return a.topic.id < b.topic.id ? -1 : 1
}

/** Oncelik azalan; esitlikte mufredat sirasi, sonra kimlik (belirlilik icin). */
function byPriorityDesc(a: Candidate, b: Candidate): number {
  if (b.priority !== a.priority) return b.priority - a.priority
  if (a.topic.orderIndex !== b.topic.orderIndex) return a.topic.orderIndex - b.topic.orderIndex
  return compareById(a, b)
}

function byCurriculumOrder(a: Candidate, b: Candidate): number {
  if (a.topic.orderIndex !== b.topic.orderIndex) return a.topic.orderIndex - b.topic.orderIndex
  return compareById(a, b)
}

function orderCandidates(candidates: Candidate[], template: PlanTemplate): Candidate[] {
  // Son 30 gun sablonu bir hizlandirma programidir: statu ayrimi yapmaz,
  // butun konulari tek listede oncelige gore siralar.
  if (template === 'last_30_days') return [...candidates].sort(byPriorityDesc)

  const weak = candidates.filter((c) => c.category === 'weak').sort(byPriorityDesc)
  const unknown = candidates.filter((c) => c.category === 'unknown').sort(byCurriculumOrder)
  const medium = candidates.filter((c) => c.category === 'medium').sort(byPriorityDesc)
  const strong = candidates.filter((c) => c.category === 'strong').sort(byPriorityDesc)
  return [...weak, ...unknown, ...medium, ...strong]
}

// ---------------------------------------------------------------------------
// Blok uretimi
// ---------------------------------------------------------------------------

function baseTypesFor(
  category: TopicCategory,
  template: PlanTemplate,
  constrained: boolean,
): StudyBlockType[] {
  // Zaman kisitliysa guclu konular tamamen programdan cikar.
  if (category === 'strong' && constrained) return []
  if (template === 'last_30_days') return ['solve', 'review']
  if (category === 'strong') return ['review']
  // Zaman kisitliysa orta seviye konular sikistirilir: izleme yok, sadece test.
  if (category === 'medium' && constrained) return ['solve']
  return ['watch', 'solve', 'review']
}

function plannedBlocksFor(
  candidate: Candidate,
  template: PlanTemplate,
  constrained: boolean,
): PlannedBlock[] {
  const allowed = TEMPLATE_TYPES[template]
  const topic = candidate.topic
  const blocks: PlannedBlock[] = []
  for (const type of baseTypesFor(candidate.category, template, constrained)) {
    if (!allowed.includes(type)) continue
    if (type === 'watch') {
      blocks.push({
        type,
        topicId: topic.id,
        minutes: Math.max(0, Math.round(topic.estimatedMinutes)),
        title: `İzle: ${topic.title}`,
      })
    } else if (type === 'solve') {
      blocks.push({
        type,
        topicId: topic.id,
        minutes: SOLVE_MINUTES,
        title: `Çöz: ${topic.title} testi`,
      })
    } else if (type === 'review') {
      blocks.push({
        type,
        topicId: topic.id,
        minutes: REVIEW_MINUTES,
        title: `Tekrar: ${topic.title} kartları`,
      })
    }
  }
  return blocks
}

// ---------------------------------------------------------------------------
// Yerlestirme (greedy first-fit)
// ---------------------------------------------------------------------------

function findEmptyDayIndex(days: DaySlot[], fromIndex: number, skipMockDays: boolean): number {
  for (let i = Math.max(0, fromIndex); i < days.length; i += 1) {
    const day = days[i]
    if (!day || day.locked || day.blocks.length > 0) continue
    if (skipMockDays && day.isMockDay) continue
    return i
  }
  return -1
}

function firstIndexOnOrAfter(days: DaySlot[], dayNumber: number): number {
  for (let i = 0; i < days.length; i += 1) {
    const day = days[i]
    if (day && day.dayNumber >= dayNumber) return i
  }
  return -1
}

function placeBlock(
  ctx: PackContext,
  fromIndex: number,
  block: PlannedBlock,
  subjectId: string,
): { index: number; day: DaySlot } | null {
  const start = Math.max(0, fromIndex)

  if (block.minutes > ctx.dailyMinutes) {
    // Gunluk butceye tek basina sigmayan blok yine de programlanir; aksi halde
    // o konu hicbir zaman calisilamazdi. Gunu tek basina isgal eder.
    ctx.oversizedSeen = true
    let index = findEmptyDayIndex(ctx.days, start, true)
    if (index < 0) index = findEmptyDayIndex(ctx.days, start, false)
    const day = index >= 0 ? ctx.days[index] : undefined
    if (!day) return null
    day.blocks.push(block)
    day.subjects.add(subjectId)
    day.remainingMinutes = 0
    day.locked = true
    return { index, day }
  }

  for (let i = start; i < ctx.days.length; i += 1) {
    const day = ctx.days[i]
    if (!day || day.locked) continue
    if (day.remainingMinutes < block.minutes) continue
    if (!day.subjects.has(subjectId) && day.subjects.size >= MAX_SUBJECTS_PER_DAY) continue
    day.blocks.push(block)
    day.subjects.add(subjectId)
    day.remainingMinutes -= block.minutes
    return { index: i, day }
  }
  return null
}

function pushUnique(list: string[], message: string): void {
  if (!list.includes(message)) list.push(message)
}

// ---------------------------------------------------------------------------
// Ana fonksiyon
// ---------------------------------------------------------------------------

export function generateStudyPlan(input: PlanInput): StudyPlanResult {
  const warnings: string[] = []
  const template: PlanTemplate = input.template ?? 'balanced'
  const dailyMinutes = Math.max(0, Math.floor(input.dailyMinutes))
  const studyDays = normalizeStudyDays(input.studyDays)

  const startDay = toDayNumber(input.startDate)
  const examDay = toDayNumber(input.examDate)
  const examPassed = examDay < startDay
  const weeksRemaining = Math.max(
    0,
    Math.ceil((input.examDate.getTime() - input.startDate.getTime()) / WEEK_MS),
  )
  if (examPassed) warnings.push(WARNING_EXAM_PASSED)

  const weeklyBudgetMinutes = dailyMinutes * studyDays.length

  if (studyDays.length === 0) {
    warnings.push(WARNING_NO_STUDY_DAYS)
    return {
      blocks: [],
      warnings,
      stats: { topicCount: 0, totalMinutes: 0, weeklyBudgetMinutes: 0, weeksRemaining },
    }
  }

  const rawWeeks = input.weeks ?? 1
  const requestedWeeks = Number.isFinite(rawWeeks) ? Math.max(1, Math.floor(rawWeeks)) : 1
  // Sinav gecmisse program tek haftaya sikistirilir (bkz. types.ts examDate notu).
  const weekCount = examPassed ? 1 : requestedWeeks

  const firstMonday = mondayOfWeek(startDay)
  const rangeEndDay = firstMonday + weekCount * 7 - 1
  // Sinav gecmisken ust sinir olarak sinav gununu kullanmak programi tamamen
  // bosaltirdi; bu durumda uretilen haftanin sonu sinir kabul edilir.
  const lastAllowedDay = examPassed ? rangeEndDay : Math.min(examDay, rangeEndDay)

  const days: DaySlot[] = []
  for (let week = 0; week < weekCount; week += 1) {
    for (let offset = 0; offset < 7; offset += 1) {
      const dayNumber = firstMonday + week * 7 + offset
      if (dayNumber < startDay || dayNumber > lastAllowedDay) continue
      if (!studyDays.includes(isoWeekday(dayNumber))) continue
      days.push({
        dayNumber,
        weekIndex: week,
        remainingMinutes: dailyMinutes,
        subjects: new Set<string>(),
        blocks: [],
        locked: false,
        isMockDay: false,
      })
    }
  }

  // Haftanin son calisma gunu denemeye ayrilir; suresi bastan rezerve edilir ki
  // deneme her zaman gune sigsin.
  for (let week = 0; week < weekCount; week += 1) {
    let lastOfWeek: DaySlot | undefined
    for (const day of days) {
      if (day.weekIndex === week) lastOfWeek = day
    }
    if (!lastOfWeek) continue
    lastOfWeek.isMockDay = true
    lastOfWeek.remainingMinutes = Math.max(0, lastOfWeek.remainingMinutes - MOCK_MINUTES)
  }

  const masteryById = new Map<string, MasteryEntry>()
  for (const entry of input.masteries) masteryById.set(entry.topicId, entry)

  const candidates: Candidate[] = input.topics.map((topic) => {
    const entry = masteryById.get(topic.id)
    const mastery = entry?.mastery ?? 0
    return {
      topic,
      category: classifyTopic(entry, mastery),
      priority: computePriority(mastery, topic),
    }
  })
  const ordered = orderCandidates(candidates, template)

  const requiredMinutes = ordered.reduce(
    (sum, candidate) =>
      sum +
      plannedBlocksFor(candidate, template, false).reduce((acc, block) => acc + block.minutes, 0),
    0,
  )
  const weeksNeeded =
    weeklyBudgetMinutes > 0
      ? Math.ceil(requiredMinutes / weeklyBudgetMinutes)
      : requiredMinutes > 0
        ? Number.POSITIVE_INFINITY
        : 0
  const constrained = weeksRemaining < weeksNeeded
  const hasStrongTopics = ordered.some((candidate) => candidate.category === 'strong')

  const ctx: PackContext = { days, dailyMinutes, oversizedSeen: false, tight: false }

  for (const candidate of ordered) {
    const planned = plannedBlocksFor(candidate, template, constrained)
    if (planned.length === 0) continue

    const subjectId = candidate.topic.subjectId
    let anchorDayNumber: number | null = null
    let searchFromIndex = 0
    let topicDropped = false

    for (const block of planned) {
      if (topicDropped) break

      let fromIndex = searchFromIndex
      if (block.type === 'review') {
        if (anchorDayNumber !== null) {
          const index = firstIndexOnOrAfter(ctx.days, anchorDayNumber + REVIEW_GAP_DAYS)
          // Uygun gun yoksa tekrar blogu dusurulur; asla erkene alinmaz.
          if (index < 0) continue
          fromIndex = index
        } else {
          fromIndex = 0
        }
      }

      const placed = placeBlock(ctx, fromIndex, block, subjectId)
      if (!placed) {
        if (block.type === 'watch') {
          // Izleme yerlesemediyse konunun kalan bloklari anlamsiz kalir.
          topicDropped = true
          ctx.tight = true
        } else if (block.type !== 'review') {
          ctx.tight = true
        }
        continue
      }
      if (anchorDayNumber === null && block.type !== 'review')
        anchorDayNumber = placed.day.dayNumber
      if (block.type === 'watch') searchFromIndex = placed.index
    }
  }

  // Haftalik deneme her uretilen haftanin son calisma gununde yer alir; konular
  // o haftaya sigmamis olsa bile hafta atlanmaz. Yalnizca programa hic konu
  // girmediyse (konu listesi bos ya da tamami elendiyse) deneme uretilmez.
  const hasScheduledTopics = days.some((day) => day.blocks.length > 0)

  const blocks: StudyBlockDraft[] = []
  for (const day of days) {
    const scheduledDate = formatDayNumber(day.dayNumber)
    let orderIndex = 0
    for (const block of day.blocks) {
      blocks.push({
        scheduledDate,
        orderIndex,
        type: block.type,
        topicId: block.topicId,
        estimatedMinutes: block.minutes,
        title: block.title,
      })
      orderIndex += 1
    }
    if (day.isMockDay && hasScheduledTopics) {
      blocks.push({
        scheduledDate,
        orderIndex,
        type: 'mock',
        topicId: null,
        estimatedMinutes: MOCK_MINUTES,
        title: MOCK_TITLE,
      })
      orderIndex += 1
    }
  }

  if (constrained) {
    pushUnique(warnings, WARNING_TIGHT)
    if (hasStrongTopics) pushUnique(warnings, WARNING_STRONG_DROPPED)
  }
  if (ctx.tight) pushUnique(warnings, WARNING_TIGHT)
  if (ctx.oversizedSeen) pushUnique(warnings, WARNING_OVERSIZED)

  const topicIds = new Set<string>()
  let totalMinutes = 0
  for (const block of blocks) {
    if (block.topicId !== null) topicIds.add(block.topicId)
    totalMinutes += block.estimatedMinutes
  }

  return {
    blocks,
    warnings,
    stats: {
      topicCount: topicIds.size,
      totalMinutes,
      weeklyBudgetMinutes,
      weeksRemaining,
    },
  }
}
