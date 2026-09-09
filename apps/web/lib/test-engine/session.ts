import { calculateNet } from '@zihin/core'

/**
 * Test motorunun saf mantığı.
 *
 * Bu dosya Supabase'i, Next.js'i ve sistem saatini TANIMAZ: girdi alır, hesaplar,
 * çıktı döner. Sebebi pratik — arka uç Docker'sız koşmuyor, dolayısıyla motorun
 * doğruluğu yalnızca birim testleriyle güvence altına alınabiliyor.
 *
 * Buradaki hiçbir fonksiyon doğru cevabı görmez; doğru/yanlış kararı çağıran
 * tarafta (service-role istemcisiyle) verilmiş olarak gelir.
 */

/** Yanlış cevap katsayısı: LGS 3, diğer sınavlar 4. */
export type WrongPenaltyDivisor = 3 | 4

/** Özet hesabı için bir sorunun gereken en az bilgisi. */
export type SummaryQuestion = {
  questionId: string
  topicId: string
}

/** Özet hesabı için bir cevabın gereken en az bilgisi. */
export type SummaryAttempt = {
  questionId: string
  /** null = boş bırakıldı (yanlış değil). */
  selectedOption: string | null
  isCorrect: boolean
  timeSpentMs: number
}

export type TopicBreakdown = {
  topicId: string
  total: number
  correct: number
  wrong: number
  blank: number
  net: number
}

export type TestSummary = {
  total: number
  correct: number
  wrong: number
  blank: number
  net: number
  /** Soru başına harcanan sürelerin toplamı (ms). */
  totalTimeMs: number
  byTopic: TopicBreakdown[]
}

/** `isSessionResumable` için gereken en az oturum bilgisi. */
export type ResumableSessionLike = {
  finished_at: string | null
  expires_at: string
}

/* ------------------------------------------------------------------------- *
 * Soru sırası
 * ------------------------------------------------------------------------- */

/**
 * 32-bit FNV-1a. Tohum bir uuid (oturum kimliği) olduğu için metinden sayıya
 * dağılımı iyi ve platformdan bağımsız bir karma gerekiyor.
 */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // İşaretsiz 32-bit'e sabitle; 0 tohum üreteci kilitler, 1'e çekilir.
  const unsigned = hash >>> 0
  return unsigned === 0 ? 1 : unsigned
}

/** mulberry32 — küçük, hızlı, deterministik sözde rastgele üreteç. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Soru sırasını tohuma göre deterministik biçimde karıştırır.
 *
 * Sıra oturum başlangıcında `test_sessions.question_order` içine YAZILIR ve
 * oturuma dönüldüğünde yeniden hesaplanmaz, o kolondan okunur (spec §M5).
 * Determinizm yine de gerekli: aynı tohum aynı sırayı vermeli ki bir hata
 * ayıklama ya da yeniden üretim durumunda sıra birebir tekrarlanabilsin.
 *
 * ŞIKLAR ASLA KARIŞTIRILMAZ — yayımlanmış şık sırası anlam taşır ("A ve B",
 * "yukarıdakilerin hepsi" gibi şıklar sıraya bağlıdır).
 */
export function buildQuestionOrder(questionIds: readonly string[], seed: string): string[] {
  const order = [...questionIds]
  if (order.length < 2) return order

  const random = mulberry32(hashSeed(seed))
  // Fisher-Yates, sondan başa.
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = order[i]
    const b = order[j]
    // noUncheckedIndexedAccess: indeksler aralık içinde ama tip sistemi bunu bilmez.
    if (a === undefined || b === undefined) continue
    order[i] = b
    order[j] = a
  }
  return order
}

/* ------------------------------------------------------------------------- *
 * Özet
 * ------------------------------------------------------------------------- */

/**
 * Oturum özeti: doğru/yanlış/boş, net ve konu kırılımı.
 *
 * Net hesabı `@zihin/core`'daki `calculateNet` ile yapılır — katsayı ve
 * yuvarlama kuralı tek yerde yaşasın diye burada yeniden yazılmaz.
 *
 * Cevaplanmamış soru ile şıkkı boşaltılmış soru aynıdır: boş. Aynı soru için
 * birden fazla kayıt gelirse SONUNCUSU geçerlidir (öğrenci şıkkını değiştirmiş
 * olabilir). Testte yer almayan bir cevap tamamen yok sayılır.
 */
export function summarise(
  questions: readonly SummaryQuestion[],
  attempts: readonly SummaryAttempt[],
  divisor: WrongPenaltyDivisor,
): TestSummary {
  const attemptByQuestion = new Map<string, SummaryAttempt>()
  for (const attempt of attempts) {
    attemptByQuestion.set(attempt.questionId, attempt)
  }

  let correct = 0
  let wrong = 0
  let blank = 0
  let totalTimeMs = 0

  const topics = new Map<string, { total: number; correct: number; wrong: number; blank: number }>()

  for (const question of questions) {
    const attempt = attemptByQuestion.get(question.questionId)
    const bucket = topics.get(question.topicId) ?? { total: 0, correct: 0, wrong: 0, blank: 0 }
    bucket.total += 1

    if (attempt === undefined || attempt.selectedOption === null) {
      blank += 1
      bucket.blank += 1
    } else if (attempt.isCorrect) {
      correct += 1
      bucket.correct += 1
    } else {
      wrong += 1
      bucket.wrong += 1
    }

    if (attempt && Number.isFinite(attempt.timeSpentMs) && attempt.timeSpentMs > 0) {
      totalTimeMs += attempt.timeSpentMs
    }

    topics.set(question.topicId, bucket)
  }

  const byTopic = Array.from(topics, ([topicId, bucket]) => ({
    topicId,
    total: bucket.total,
    correct: bucket.correct,
    wrong: bucket.wrong,
    blank: bucket.blank,
    net: calculateNet(bucket.correct, bucket.wrong, divisor),
  })).sort((a, b) => (a.topicId < b.topicId ? -1 : a.topicId > b.topicId ? 1 : 0))

  return {
    total: questions.length,
    correct,
    wrong,
    blank,
    net: calculateNet(correct, wrong, divisor),
    totalTimeMs,
    byTopic,
  }
}

/* ------------------------------------------------------------------------- *
 * Sürdürülebilirlik ve gezinme
 * ------------------------------------------------------------------------- */

/**
 * Yarım kalan oturum sürdürülebilir mi? Bitmemiş VE süresi dolmamış olmalı
 * (spec §M5: 24 saat). Sınır anı (`expires_at === now`) dolmuş sayılır —
 * "24 saat içinde" ifadesi kapalı üst sınır içermez.
 */
export function isSessionResumable(session: ResumableSessionLike, now: Date): boolean {
  if (session.finished_at !== null) return false
  const expiresAt = Date.parse(session.expires_at)
  // Okunamayan bir zaman damgasında en kısıtlı varsayım: sürdürülemez.
  if (Number.isNaN(expiresAt)) return false
  return expiresAt > now.getTime()
}

/** `canRevealAnswers` için gereken en az oturum bilgisi. */
export type RevealableSessionLike = {
  finished_at: string | null
}

/**
 * Cevap anahtarı bu oturum için açılabilir mi?
 *
 * Ürünün en önemli değişmezi: doğru şık, açıklama ve çözüm videosu YALNIZCA
 * bitmiş bir oturum için verilir. Bu denetim olmasaydı kullanıcı testi başlatıp
 * hiçbir soruyu cevaplamadan bütün cevap anahtarını okuyabilirdi.
 *
 * `finished_at` alanı `test_sessions` satırından, yani veritabanından gelir;
 * istemciden gelen hiçbir değer buraya giremez. Boş metin ya da beyaz boşluk
 * gibi "dolu görünen ama anlamsız" damgalar bitmiş sayılmaz.
 */
export function canRevealAnswers<T extends RevealableSessionLike>(
  session: T,
): session is T & { finished_at: string } {
  const finishedAt = session.finished_at
  if (typeof finishedAt !== 'string') return false
  return finishedAt.trim().length > 0
}

/**
 * "Sonraki boş soru" denetimi. `fromIndex`'ten SONRA gelen ilk cevaplanmamış
 * sorunun indeksini döner ve listenin sonuna gelince başa sarar. Hiç boş soru
 * kalmadıysa null döner (kullanıcı bitirebilir).
 *
 * `fromIndex` verilmezse aramaya baştan başlanır ve mevcut soru da adaydır;
 * verildiğinde ise kendisi atlanır, yoksa "sonraki" düğmesi yerinde sayardı.
 */
export function nextUnanswered(
  order: readonly string[],
  answered: Iterable<string>,
  fromIndex?: number,
): number | null {
  if (order.length === 0) return null
  const answeredSet = answered instanceof Set ? answered : new Set(answered)

  const start = fromIndex === undefined ? 0 : fromIndex + 1
  for (let step = 0; step < order.length; step += 1) {
    // Modülo ile başa sarma; negatif fromIndex de güvenli konuma düşer.
    const index = (((start + step) % order.length) + order.length) % order.length
    const questionId = order[index]
    if (questionId === undefined) continue
    if (!answeredSet.has(questionId)) return index
  }
  return null
}
