/**
 * @zihin/core — çerçeve bağımsız iş mantığı.
 *
 * Buradaki hiçbir dosya Next.js, React, Supabase ya da ağ katmanını tanımaz.
 * Girdi alır, hesaplar, çıktı döner. Bu sayede doğrudan test edilebilir ve
 * ileride farklı bir çalışma zamanında (edge function, kuyruk işleyicisi)
 * aynı sonucu üretir.
 *
 * Tek bir kural: bir fonksiyon "şu an" bilgisine ihtiyaç duyuyorsa bunu
 * parametre olarak alır. `Date.now()` çağrısı yoktur — bu, testlerin
 * tekrarlanabilir olmasını sağlayan şeydir.
 */

export * from './types'

// Yetkinlik motoru — çözülen sorulardan konu bazlı 0-100 puan üretir.
export {
  calculateMastery,
  classifyMastery,
  rankPriorityTopics,
  DEFAULT_EXPECTED_SECONDS,
} from './mastery'

// Kişisel çalışma programı üretimi.
export { generateStudyPlan } from './studyPlan'

// Aralıklı tekrar (SM-2).
export { sm2, initialCardState, isDue, selectDueCards } from './spacedRepetition'

// Net, deneme özeti ve yüzdelik dilim hesapları.
export {
  calculateNet,
  calculateMockSummary,
  calculatePercentile,
  MIN_PERCENTILE_SAMPLE,
} from './scoring'

// Puan, seviye, seri ve rozetler.
export {
  computeXp,
  levelForXp,
  updateStreak,
  evaluateBadges,
  XP_TABLE,
  LEVEL_COUNT,
} from './gamification'
