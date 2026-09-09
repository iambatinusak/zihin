/**
 * Yetkinlik (mastery) motoru.
 *
 * Bir konudaki cozum denemelerinden 0-100 arasi tek bir yetkinlik puani uretir.
 * Puan uc sinyali birlestirir: guncellik agirlikli dogruluk, hiz ve veri
 * yeterliligi (guven). Veri azken sonuc notr onsele (35) cekilir; boylece iki
 * soru cozmus bir ogrenci "guclu" ya da "zayif" damgasi yemez.
 *
 * Fonksiyonlar saf ve deterministiktir: sistem saatine bakmaz, ayni girdi her
 * zaman ayni ciktiyi verir.
 */

import type {
  AttemptLike,
  MasteryEntry,
  MasteryResult,
  MasteryStatus,
  PriorityTopic,
  TopicLike,
} from './types'

/** Hesaba giren en yeni deneme sayisi. */
const WINDOW_SIZE = 30

/** Agirligin yariya dustugu deneme araligi: w_i = 0.5 ** (i / 10). */
const RECENCY_HALF_LIFE = 10

/** Ayni sorunun tekrar cozumleri: ezberleme etkisini kirmak icin dusuk agirlik. */
const REPEAT_WEIGHT = 0.3

/** Guvenin 1.0'a ulastigi deneme sayisi. */
const CONFIDENCE_FULL_AT = 8

/** Veri yokken varsayilan yetkinlik orani (100 * 0.35 = 35 puan). */
const NEUTRAL_PRIOR = 0.35

/** Bu sayinin altinda siniflandirma yapilmaz. */
const MIN_ATTEMPTS_FOR_STATUS = 3

const SPEED_BASE = 1.15
const SPEED_SLOPE = 0.15
const SPEED_MIN = 0.85
const SPEED_MAX = 1.15

const DIFFICULTY_MIN = 1
const DIFFICULTY_MAX = 5

function clamp(value: number, min: number, max: number): number {
  // NaN/Infinity gelirse hesap zincirini kirmamak icin alt sinira cekilir.
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function clampDifficulty(difficulty: number): number {
  return clamp(difficulty, DIFFICULTY_MIN, DIFFICULTY_MAX)
}

/**
 * Sorunun beklenen cozum suresi bilinmiyorsa kullanilan varsayilan (saniye).
 * Zorluk 1-5 araligina kirpilir.
 */
export function DEFAULT_EXPECTED_SECONDS(difficulty: number): number {
  return 60 + 20 * clampDifficulty(difficulty)
}

function toTimestamp(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  // Gecersiz tarih siralamayi bozmasin: en eski kabul edilip pencerenin disina itilir.
  return Number.isFinite(ms) ? ms : 0
}

/** Denemeleri yeniden eskiye siralar ve en yeni WINDOW_SIZE tanesini alir. */
function selectWindow(attempts: AttemptLike[]): AttemptLike[] {
  const indexed = attempts.map((attempt, index) => ({ attempt, index }))
  indexed.sort((a, b) => {
    const byTime = toTimestamp(b.attempt.answeredAt) - toTimestamp(a.attempt.answeredAt)
    // Ayni zaman damgasinda girdi sirasi belirleyicidir; sonuc tekrarlanabilir kalir.
    return byTime !== 0 ? byTime : a.index - b.index
  })
  return indexed.slice(0, WINDOW_SIZE).map((entry) => entry.attempt)
}

/**
 * Pencere icindeki her deneme icin tekrar sirasini belirler.
 * Sayac eskiden yeniye ilerler: bir sorunun EN ESKI cozumu 0 (tam agirlik),
 * sonraki cozumleri sifirdan buyuk olur.
 */
function resolveRepeatIndices(windowDesc: AttemptLike[]): number[] {
  const seenCount = new Map<string, number>()
  const indices: number[] = new Array<number>(windowDesc.length).fill(0)
  for (let i = windowDesc.length - 1; i >= 0; i--) {
    const attempt = windowDesc[i]
    if (attempt === undefined) continue
    const seen = seenCount.get(attempt.questionId) ?? 0
    seenCount.set(attempt.questionId, seen + 1)
    const provided = attempt.repeatIndex
    indices[i] = typeof provided === 'number' && Number.isFinite(provided) ? provided : seen
  }
  return indices
}

type WeightedAttempt = {
  /** Guncellik agirligi x tekrar carpani. */
  weight: number
  /** Zorluga gore duzeltilmis dogruluk. */
  corrAdj: number
  /** Harcanan sure / beklenen sure. */
  ratio: number
}

function buildWeighted(windowDesc: AttemptLike[]): WeightedAttempt[] {
  const repeatIndices = resolveRepeatIndices(windowDesc)
  const weighted: WeightedAttempt[] = []
  for (let i = 0; i < windowDesc.length; i++) {
    const attempt = windowDesc[i]
    if (attempt === undefined) continue
    const difficulty = clampDifficulty(attempt.difficulty)
    const repeatIndex = repeatIndices[i] ?? 0
    const recency = Math.pow(0.5, i / RECENCY_HALF_LIFE)
    const weight = recency * (repeatIndex > 0 ? REPEAT_WEIGHT : 1)

    // Zor soruyu bilmek daha degerli: dogru cevap 0.9 (zorluk 1) ile 1.3 (zorluk 5) arasi puanlanir.
    const corrAdj = attempt.isCorrect ? 0.8 + 0.1 * difficulty : 0

    const declared = attempt.expectedSeconds
    const expectedSeconds =
      declared !== null && Number.isFinite(declared) && declared > 0
        ? declared
        : DEFAULT_EXPECTED_SECONDS(difficulty)
    const spentSeconds = Number.isFinite(attempt.timeSpentMs)
      ? Math.max(0, attempt.timeSpentMs) / 1000
      : 0

    weighted.push({ weight, corrAdj, ratio: spentSeconds / expectedSeconds })
  }
  return weighted
}

/** Medyan; cift sayida deger varsa iki ortancanin ortalamasi. */
function median(values: number[]): number {
  if (values.length === 0) return 1
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 1
  const lower = sorted[mid - 1]
  const upper = sorted[mid]
  if (lower === undefined || upper === undefined) return 1
  return (lower + upper) / 2
}

/**
 * Tek bir konu icin yetkinlik puani hesaplar.
 * Girdi: o konuya ait denemeler (sirali olmak zorunda degil).
 */
export function calculateMastery(attempts: AttemptLike[]): MasteryResult {
  const windowDesc = selectWindow(attempts)
  const n = windowDesc.length
  if (n === 0) {
    return { mastery: Math.round(100 * NEUTRAL_PRIOR), status: 'unknown', n: 0 }
  }

  const weighted = buildWeighted(windowDesc)

  let weightSum = 0
  let weightedCorrect = 0
  const ratios: number[] = []
  for (const item of weighted) {
    weightSum += item.weight
    weightedCorrect += item.weight * item.corrAdj
    ratios.push(item.ratio)
  }

  const accAdj = weightSum > 0 ? clamp(weightedCorrect / weightSum, 0, 1) : 0
  // Medyan kullanilir: tek bir "molaya cikilmis" deneme hiz katsayisini bozmasin.
  const speed = clamp(SPEED_BASE - SPEED_SLOPE * median(ratios), SPEED_MIN, SPEED_MAX)
  const confidence = Math.min(1, n / CONFIDENCE_FULL_AT)

  // Veri azken sonuc notr onsele karisir; az veriyle uc puan uretmemek icin.
  const raw = 100 * accAdj * speed * confidence + 100 * NEUTRAL_PRIOR * (1 - confidence)
  const mastery = clamp(Math.round(raw), 0, 100)

  return { mastery, status: classifyMastery(mastery, n), n }
}

/** Puani ve deneme sayisini etikete cevirir. Veri yetersizse 'unknown'. */
export function classifyMastery(mastery: number, n: number): MasteryStatus {
  if (n < MIN_ATTEMPTS_FOR_STATUS) return 'unknown'
  if (!Number.isFinite(mastery)) return 'unknown'
  if (mastery < 50) return 'weak'
  if (mastery < 75) return 'medium'
  return 'strong'
}

/**
 * Konulari calisma onceligine gore siralar (azalan).
 * Yetkinlik kaydi olmayan konu, veri yokken uretilen notr onselle (35/unknown)
 * degerlendirilir; boylece hic dokunulmamis konular listede kaybolmaz.
 */
export function rankPriorityTopics(
  masteries: MasteryEntry[],
  topics: TopicLike[],
): PriorityTopic[] {
  const byTopicId = new Map<string, MasteryEntry>()
  for (const entry of masteries) {
    // Ayni konu icin birden fazla kayit gelirse ilki gecerli sayilir.
    if (!byTopicId.has(entry.topicId)) byTopicId.set(entry.topicId, entry)
  }

  const ranked: PriorityTopic[] = topics.map((topic) => {
    const entry = byTopicId.get(topic.id)
    const mastery = entry !== undefined ? entry.mastery : 100 * NEUTRAL_PRIOR
    const status: MasteryStatus = entry !== undefined ? entry.status : 'unknown'
    const priority = (100 - mastery) * topic.examWeight * (1 + 0.2 * topic.difficulty)
    return { topic, mastery, status, priority }
  })

  ranked.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    // Esitlikte mufredat sirasi, sonra id: siralama her calistirmada ayni kalsin.
    if (a.topic.orderIndex !== b.topic.orderIndex) return a.topic.orderIndex - b.topic.orderIndex
    return a.topic.id < b.topic.id ? -1 : a.topic.id > b.topic.id ? 1 : 0
  })

  return ranked
}
