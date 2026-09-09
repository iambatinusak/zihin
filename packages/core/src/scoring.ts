/**
 * @zihin/core — puanlama (net, deneme ozeti, yuzdelik dilim).
 *
 * Turkiye sinav sisteminde "net" = dogru - yanlis / katsayi. Katsayi sinav
 * tipine gore degisir: TYT/AYT/KPSS/DGS/ALES icin 4, LGS icin 3.
 * Net NEGATIF olabilir ve sifira kirpilmaz — sinav yonetmeligi boyle isler,
 * ogrenciye "0 net" gostermek yaniltici olurdu.
 */

import type {
  MockAttemptInput,
  MockSectionInput,
  MockSectionSummary,
  MockSummary,
  WrongPenaltyDivisor,
} from './types'

/**
 * Yuzdelik dilimin gosterilebilmesi icin gereken en az katilimci sayisi.
 * Sartname §15: bunun altinda istatistik anlamsiz, UI "yeterli veri yok" der.
 */
export const MIN_PERCENTILE_SAMPLE = 20

/**
 * Ikili kayan nokta artiklarini yutan yuvarlama esigi.
 * 10 - 1/3 = 9.666666666666666 gibi degerlerde son basamak hatasinin
 * yuvarlamayi asagi cekmesini engeller.
 */
const ROUNDING_EPSILON = 1e-9

/**
 * Yarim degerleri SIFIRDAN UZAGA yuvarlar (Math.round yarimlari daima yukari
 * atar, bu da negatif netlerde asimetri yaratirdi: -0.125 -> -0.12 ama
 * 0.125 -> 0.13). Ayrica -0 uretmez; JSON'a ve UI'a "-0" sizmasi kabul edilemez.
 */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  const sign = value < 0 ? -1 : 1
  const scaled = Math.abs(value) * factor
  const result = (sign * Math.round(scaled + ROUNDING_EPSILON)) / factor
  // -0 === 0 oldugu icin bu kontrol negatif sifiri duz sifira cevirir.
  return result === 0 ? 0 : result
}

/** Sayim alanlarini savunmaci sekilde temizler: gecersiz/negatif adet 0 sayilir. */
function sanitizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

/**
 * Net hesabi: dogru - yanlis / katsayi, 2 basamaga yuvarlanir.
 * Negatif sonuc kirpilmaz.
 */
export function calculateNet(correct: number, wrong: number, divisor: WrongPenaltyDivisor): number {
  const safeCorrect = sanitizeCount(correct)
  const safeWrong = sanitizeCount(wrong)
  // Katsayi tip sistemi disindan (JS cagrisi) 0 gelirse bolme sonsuz olurdu.
  const safeDivisor = divisor === 3 ? 3 : 4
  return roundTo(safeCorrect - safeWrong / safeDivisor, 2)
}

/** Deneme ozeti icin bir sorunun sonucu. */
type QuestionOutcome = 'correct' | 'wrong' | 'blank'

function outcomeOf(attempt: MockAttemptInput | undefined): QuestionOutcome {
  // Cevaplanmamis soru ile "sikki bosaltilmis" soru ayni sey: bos.
  if (attempt === undefined || attempt.selectedOption === null) return 'blank'
  return attempt.isCorrect ? 'correct' : 'wrong'
}

/**
 * Deneme sinavi ozeti: ders bazli ve genel dogru/yanlis/bos/net kirilimi.
 *
 * Bir soru birden fazla bolumde gecerse her bolumde ayri sayilir (cagiranin
 * sorunu; burada cokmemesi yeterli). Hicbir bolumde yer almayan bir cevap ise
 * tamamen yok sayilir — bayat bir kayit toplami bozmamali.
 */
export function calculateMockSummary(
  sections: MockSectionInput[],
  attempts: MockAttemptInput[],
  config: { divisor: WrongPenaltyDivisor; durationSeconds?: number | null },
): MockSummary {
  const divisor = config.divisor

  // Ayni soru icin birden fazla kayit gelirse SONUNCUSU gecerlidir:
  // ogrenci sikkini degistirdiginde son isaretleme baglayicidir.
  const attemptByQuestion = new Map<string, MockAttemptInput>()
  for (const attempt of attempts) {
    attemptByQuestion.set(attempt.questionId, attempt)
  }

  const knownQuestionIds = new Set<string>()
  for (const section of sections) {
    for (const questionId of section.questionIds) {
      knownQuestionIds.add(questionId)
    }
  }

  const sectionSummaries: MockSectionSummary[] = []
  let total = 0
  let correct = 0
  let wrong = 0
  let blank = 0
  let netSum = 0

  for (const section of sections) {
    let sectionCorrect = 0
    let sectionWrong = 0
    let sectionBlank = 0

    for (const questionId of section.questionIds) {
      const outcome = outcomeOf(attemptByQuestion.get(questionId))
      if (outcome === 'correct') sectionCorrect += 1
      else if (outcome === 'wrong') sectionWrong += 1
      else sectionBlank += 1
    }

    const sectionNet = calculateNet(sectionCorrect, sectionWrong, divisor)
    sectionSummaries.push({
      subjectId: section.subjectId,
      subjectName: section.subjectName,
      total: section.questionIds.length,
      correct: sectionCorrect,
      wrong: sectionWrong,
      blank: sectionBlank,
      net: sectionNet,
    })

    total += section.questionIds.length
    correct += sectionCorrect
    wrong += sectionWrong
    blank += sectionBlank
    netSum += sectionNet
  }

  // Konu kirilimi cevaplar uzerinden yurur: ayni soru iki bolumde de gecse
  // konu istatistigi tek kez artar, yoksa mastery motoru sisirilmis veri alir.
  const topicTotals = new Map<string, { total: number; correct: number }>()
  for (const attempt of attemptByQuestion.values()) {
    if (!knownQuestionIds.has(attempt.questionId)) continue
    if (attempt.selectedOption === null) continue
    const entry = topicTotals.get(attempt.topicId) ?? { total: 0, correct: 0 }
    entry.total += 1
    if (attempt.isCorrect) entry.correct += 1
    topicTotals.set(attempt.topicId, entry)
  }

  const byTopic = Array.from(topicTotals, ([topicId, entry]) => ({
    topicId,
    total: entry.total,
    correct: entry.correct,
  })).sort((a, b) => (a.topicId < b.topicId ? -1 : a.topicId > b.topicId ? 1 : 0))

  return {
    sections: sectionSummaries,
    total,
    correct,
    wrong,
    blank,
    net: roundTo(netSum, 2),
    byTopic,
    durationSeconds: config.durationSeconds ?? null,
  }
}

/**
 * Yuzdelik dilim (orta-siralama tanimi): kendisinden DUSUK olanlarin orani +
 * esit olanlarin yarisi. Bu tanim medyani ~50'de tutar ve "birinci ogrenci
 * 100 degil 99 aliyor" garipligini ortadan kaldirir.
 *
 * @param allNets Kullanicinin kendi netini de ICEREN tum katilimci netleri.
 *                Sirali olmasi gerekmez.
 * @returns 0-100 arasi, 1 basamaga yuvarlanmis deger; ornek yetersizse null.
 */
export function calculatePercentile(userNet: number, allNets: number[]): number | null {
  // Gecersiz kayitlar hem esigi hem paydayi bozmasin diye once ayiklanir.
  const validNets = allNets.filter((net) => Number.isFinite(net))
  if (validNets.length < MIN_PERCENTILE_SAMPLE) return null
  if (!Number.isFinite(userNet)) return null

  let lower = 0
  let equal = 0
  for (const net of validNets) {
    if (net < userNet) lower += 1
    else if (net === userNet) equal += 1
  }

  const ratio = (lower + equal / 2) / validNets.length
  const percentile = roundTo(ratio * 100, 1)
  return Math.min(100, Math.max(0, percentile))
}
