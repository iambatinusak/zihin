import type { StudyBlockDraft, StudyBlockType } from '@zihin/core'

/**
 * Plan üretiminin saf yardımcıları: içerik eşleme ve tamamlanmış blokların
 * korunması. Supabase tanımaz, `Date.now()` çağırmaz — bu yüzden tamamı
 * birim testlidir (`blocks.test.ts`).
 *
 * Neden `@zihin/core` değil: buradaki kurallar veritabanı gerçekliğine bağlı
 * (bir konunun videosu var mı, hangi test tipi tercih edilir). Core, şema
 * bilmeyen katman; bu eşleme uygulamaya aittir (CONVENTIONS §5).
 */

// ---------------------------------------------------------------------------
// İçerik eşleme
// ---------------------------------------------------------------------------

export type VideoCandidate = {
  id: string
  topicId: string
  /** 'lecture' | 'summary' | 'solution' */
  type: string
  orderIndex: number
}

export type TestCandidate = {
  id: string
  topicId: string
  /** 'topic_test' | 'unit_test' | 'quick_practice' | 'mock_exam' */
  type: string
}

/** Bloğa bağlanacak video tercihi: önce ders anlatımı. */
const VIDEO_TYPE_RANK: Record<string, number> = { lecture: 0, summary: 1, solution: 2 }
/** Bloğa bağlanacak test tercihi: önce konu testi. */
const TEST_TYPE_RANK: Record<string, number> = {
  topic_test: 0,
  unit_test: 1,
  quick_practice: 2,
  mock_exam: 3,
}

const UNRANKED = 99

function rankOf(table: Record<string, number>, type: string): number {
  return table[type] ?? UNRANKED
}

/**
 * Her konu için tek bir video seçer. Seçim DETERMİNİSTİKTİR: tip sırası,
 * sonra müfredat sırası, sonra kimlik. Aynı veriyle iki üretim aynı videoyu
 * bağlar; kullanıcı programı yenilediğinde bağlantılar yerinden oynamaz.
 */
export function selectVideoByTopic(candidates: readonly VideoCandidate[]): Map<string, string> {
  const best = new Map<string, VideoCandidate>()
  for (const candidate of candidates) {
    const current = best.get(candidate.topicId)
    if (!current || compareVideos(candidate, current) < 0) best.set(candidate.topicId, candidate)
  }
  return new Map([...best].map(([topicId, video]) => [topicId, video.id]))
}

function compareVideos(a: VideoCandidate, b: VideoCandidate): number {
  const rankDiff = rankOf(VIDEO_TYPE_RANK, a.type) - rankOf(VIDEO_TYPE_RANK, b.type)
  if (rankDiff !== 0) return rankDiff
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Her konu için tek bir test seçer. Kural `selectVideoByTopic` ile aynı. */
export function selectTestByTopic(candidates: readonly TestCandidate[]): Map<string, string> {
  const best = new Map<string, TestCandidate>()
  for (const candidate of candidates) {
    const current = best.get(candidate.topicId)
    if (!current || compareTests(candidate, current) < 0) best.set(candidate.topicId, candidate)
  }
  return new Map([...best].map(([topicId, test]) => [topicId, test.id]))
}

function compareTests(a: TestCandidate, b: TestCandidate): number {
  const rankDiff = rankOf(TEST_TYPE_RANK, a.type) - rankOf(TEST_TYPE_RANK, b.type)
  if (rankDiff !== 0) return rankDiff
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export type BlockContent = { videoId: string | null; testId: string | null }

/**
 * Bloğun içerik bağlantısı. Konunun içeriği yoksa `null` döner ve blok yine
 * de üretilir — 1164 konunun yalnızca birkaçının videosu var; içeriği olmayan
 * konuyu programdan düşürmek programı boşaltırdı. Arayüz bu durumu
 * "içerik hazırlanıyor" olarak gösterir.
 */
export function resolveBlockContent(
  type: StudyBlockType,
  topicId: string | null,
  videoByTopic: ReadonlyMap<string, string>,
  testByTopic: ReadonlyMap<string, string>,
): BlockContent {
  if (topicId === null) return { videoId: null, testId: null }
  if (type === 'watch') return { videoId: videoByTopic.get(topicId) ?? null, testId: null }
  if (type === 'solve') return { videoId: null, testId: testByTopic.get(topicId) ?? null }
  // 'review' hafıza kartlarına, 'mock' deneme akışına gider; ikisi de blok
  // üzerinde bir kimlik taşımaz.
  return { videoId: null, testId: null }
}

// ---------------------------------------------------------------------------
// Tamamlanmış blokların korunması (spec §M8)
// ---------------------------------------------------------------------------

export type PreservedBlock = {
  id: string
  scheduledDate: string
  orderIndex: number
  type: StudyBlockType
  topicId: string | null
}

export type MergeResult = {
  /** Yeni plana yazılacak taslaklar; sıra numaraları korunanların ardına kaydırılmış. */
  drafts: StudyBlockDraft[]
  /** Zaten tamamlandığı için üretilmeyen taslak sayısı. */
  skipped: number
}

function draftKey(type: StudyBlockType, topicId: string | null): string {
  // Konusuz blok (deneme) hafta başına tektir; kimliği yalnızca tipidir.
  return topicId === null ? `type:${type}` : `${type}:${topicId}`
}

/**
 * Yeniden üretilen taslakları, korunan tamamlanmış bloklarla birleştirir.
 *
 * İki kural:
 *  1. Kullanıcının bu hafta zaten tamamladığı bir iş (aynı tip + aynı konu)
 *     yeniden programlanmaz — yoksa "İzle: Türev"i bitiren öğrenci programı
 *     yenilediğinde onu tekrar önünde bulurdu.
 *  2. Kalan taslakların gün içi sıra numaraları, o güne çakılı duran korunmuş
 *     blokların ardına kaydırılır; `(gün, order_index)` çifti tekil kalır.
 */
export function mergeWithPreserved(
  drafts: readonly StudyBlockDraft[],
  preserved: readonly PreservedBlock[],
): MergeResult {
  const doneKeys = new Set(preserved.map((block) => draftKey(block.type, block.topicId)))

  const offsetByDate = new Map<string, number>()
  for (const block of preserved) {
    const current = offsetByDate.get(block.scheduledDate) ?? -1
    if (block.orderIndex > current) offsetByDate.set(block.scheduledDate, block.orderIndex)
  }

  const kept: StudyBlockDraft[] = []
  let skipped = 0

  for (const draft of drafts) {
    if (doneKeys.has(draftKey(draft.type, draft.topicId))) {
      skipped += 1
      continue
    }
    const offset = (offsetByDate.get(draft.scheduledDate) ?? -1) + 1
    kept.push({ ...draft, orderIndex: draft.orderIndex + offset })
  }

  return { drafts: kept, skipped }
}

/** Bir günün bloklarını gösterim sırasına dizer: sıra numarası, sonra kimlik. */
export function compareBlocksForDisplay(
  a: { orderIndex: number; id: string },
  b: { orderIndex: number; id: string },
): number {
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
