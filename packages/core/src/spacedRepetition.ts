/**
 * @zihin/core — Aralikli tekrar (SM-2).
 *
 * SuperMemo-2 algoritmasinin saf, yan etkisiz uygulamasi. Tum fonksiyonlar
 * "simdi" bilgisini disaridan parametre olarak alir; icerde `Date.now()` ya da
 * bos `new Date()` cagrilmaz. Boylece ayni girdi her calistirmada ayni ciktiyi
 * uretir ve testler saate bagli kirilmaz.
 */

import type { CardState, ReviewGrade } from './types'

/** Bir gunun milisaniye karsiligi. Turkiye UTC+3'te sabittir (yaz saati yok),
 *  bu yuzden gun ekleme takvim yerine duz ms toplamiyla yapilabilir. */
const MS_PER_DAY = 86_400_000

/** SM-2'nin taban kolaylik katsayisi. */
export const INITIAL_EASE_FACTOR = 2.5

/** Kolaylik katsayisi tabani. Bunun altina inilmesi tekrar araliklarini
 *  pratikte donduracagi icin SM-2 orijinalinde de 1.3 ile sinirlandirilir.
 *  Ust sinir yoktur: cok kolay bulunan kartlarin acilmasi istenen davranistir. */
export const MIN_EASE_FACTOR = 1.3

/** Ikinci basarili tekrardan sonraki sabit aralik (SM-2 orijinali). */
const SECOND_INTERVAL_DAYS = 6

/** Basarili sayilan en dusuk puan. 3'un altindaki her puan kartI sifirlar. */
const PASSING_GRADE = 3

/** Gunluk tekrar kotasi. Urun karari: 50 kart/gun. `selectDueCards` cagrisinda
 *  degistirilebilir. */
export const DEFAULT_DAILY_REVIEW_LIMIT = 50

/**
 * Yeni bir kartin baslangic durumu.
 *
 * `nextReviewAt` icin `now` klonlanir: cagiranin elindeki Date nesnesi ile
 * kart durumu ayni referansi paylasirsa, disarida yapilan bir `setDate` kart
 * takvimini de sessizce bozar.
 */
export function initialCardState(now: Date): CardState {
  return {
    easeFactor: INITIAL_EASE_FACTOR,
    intervalDays: 1,
    repetitions: 0,
    nextReviewAt: new Date(now.getTime()),
    lastGrade: null,
  }
}

/**
 * SM-2 kolaylik katsayisi guncellemesi.
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 *
 * Formul basarisiz puanlar (q < 3) icin de uygulanir; SM-2'de basarisizlik
 * EF'i dusurur, aralik sifirlanmasi ise bundan bagimsiz olarak yurur.
 */
function nextEaseFactor(previousEaseFactor: number, grade: ReviewGrade): number {
  const delta = 5 - grade
  const updated = previousEaseFactor + (0.1 - delta * (0.08 + delta * 0.02))
  return Math.max(MIN_EASE_FACTOR, updated)
}

/**
 * Bir tekrar sonrasi yeni kart durumunu hesaplar.
 *
 * SIRALAMA KARARI: kolaylik katsayisi araliktan ONCE guncellenir ve
 * `repetitions >= 2` durumundaki carpim YENI EF ile yapilir. Klasik SM-2
 * (SuperMemo 2, 1987) bu sirayi kullanir; tersi bir sirada kart, hak ettigi
 * araligi bir tekrar gecikmeli alir.
 *
 * `prev` ve `now` degistirilmez; her cagri yeni nesneler dondurur.
 */
export function sm2(prev: CardState, grade: ReviewGrade, now: Date): CardState {
  const easeFactor = nextEaseFactor(prev.easeFactor, grade)

  let intervalDays: number
  let repetitions: number

  if (grade < PASSING_GRADE) {
    // Basarisiz tekrar: kart en bastan ogrenilmeye baslar, ertesi gune atilir.
    repetitions = 0
    intervalDays = 1
  } else {
    repetitions = prev.repetitions + 1
    if (prev.repetitions === 0) {
      intervalDays = 1
    } else if (prev.repetitions === 1) {
      intervalDays = SECOND_INTERVAL_DAYS
    } else {
      // Bozuk/eksik kayitlardan gelen 0 veya negatif aralik kartI sonsuz
      // dongude bugune sabitlerdi; en az 1 gun garanti edilir.
      intervalDays = Math.max(1, Math.round(prev.intervalDays * easeFactor))
    }
  }

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewAt: new Date(now.getTime() + intervalDays * MS_PER_DAY),
    lastGrade: grade,
  }
}

/** Kartin tekrar zamani geldi mi? Tam esitlik de "geldi" sayilir. */
export function isDue(card: CardState, now: Date): boolean {
  return card.nextReviewAt.getTime() <= now.getTime()
}

/**
 * Zamani gelmis kartlari en eski `nextReviewAt` once olacak sekilde siralar ve
 * gunluk kotaya gore kirpar.
 *
 * Esit tarihlerde girdi sirasi korunur (stabil siralama): kartlar cogu zaman
 * mufredat sirasiyla gelir, ayni anda dolan kartlarin sirasinin cagridan
 * cagriya degismemesi kullanici acisindan onemlidir.
 */
export function selectDueCards<T extends { state: CardState }>(
  cards: T[],
  now: Date,
  limit: number = DEFAULT_DAILY_REVIEW_LIMIT,
): T[] {
  // Negatif/ondalikli/NaN limitler cagri katmanindan (form, query string)
  // gelebilir; kotayi burada saglama alip 0 ile sinirliyoruz. Infinity ise
  // bilincli olarak "kota yok" anlamina gelir.
  const cap = Number.isNaN(limit) ? 0 : Math.max(0, Math.floor(limit))
  if (cap === 0) return []

  const due: Array<{ card: T; order: number; at: number }> = []
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i]
    // noUncheckedIndexedAccess: seyrek dizilerde eleman gercekten yok olabilir.
    if (card === undefined) continue
    if (!isDue(card.state, now)) continue
    due.push({ card, order: i, at: card.state.nextReviewAt.getTime() })
  }

  due.sort((a, b) => (a.at === b.at ? a.order - b.order : a.at - b.at))

  return due.slice(0, cap).map((entry) => entry.card)
}
