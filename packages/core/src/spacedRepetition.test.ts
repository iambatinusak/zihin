import { describe, it, expect } from 'vitest'
import type { CardState, ReviewGrade } from './types'
import {
  sm2,
  initialCardState,
  isDue,
  selectDueCards,
  INITIAL_EASE_FACTOR,
  MIN_EASE_FACTOR,
  DEFAULT_DAILY_REVIEW_LIMIT,
} from './spacedRepetition'

const NOW = new Date('2026-03-02T09:00:00+03:00')
const MS_PER_DAY = 86_400_000

/** Testlerde tarih karsilastirmasini okunur tutmak icin. */
function daysAfter(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY)
}

/** Ard arda tekrar uygulayip son durumu doner. */
function review(start: CardState, grades: ReviewGrade[], now: Date): CardState {
  return grades.reduce<CardState>((state, grade) => sm2(state, grade, now), start)
}

function cardAt(at: Date): CardState {
  return { ...initialCardState(NOW), nextReviewAt: at }
}

describe('initialCardState', () => {
  it('yeni kart 2.5 EF, 1 gun aralik ve 0 tekrar ile baslar', () => {
    const card = initialCardState(NOW)
    expect(card.easeFactor).toBe(INITIAL_EASE_FACTOR)
    expect(card.easeFactor).toBe(2.5)
    expect(card.intervalDays).toBe(1)
    expect(card.repetitions).toBe(0)
    expect(card.lastGrade).toBeNull()
  })

  it('nextReviewAt tam olarak verilen ana esittir (kart hemen calisilabilir)', () => {
    const card = initialCardState(NOW)
    expect(card.nextReviewAt.getTime()).toBe(NOW.getTime())
  })

  it('nextReviewAt cagirana ait Date nesnesinin referansini paylasmaz', () => {
    const now = new Date('2026-03-02T09:00:00+03:00')
    const card = initialCardState(now)
    expect(card.nextReviewAt).not.toBe(now)
    now.setFullYear(2030)
    expect(card.nextReviewAt.toISOString()).toBe('2026-03-02T06:00:00.000Z')
  })
})

describe('sm2 — basarili tekrar dizisi', () => {
  it('ust uste dort kez 5 puani: araliklar 1, 6, 17, 49 olur', () => {
    const s0 = initialCardState(NOW)

    const s1 = sm2(s0, 5, NOW)
    expect(s1.intervalDays).toBe(1)
    expect(s1.repetitions).toBe(1)
    expect(s1.easeFactor).toBeCloseTo(2.6, 10)

    const s2 = sm2(s1, 5, NOW)
    expect(s2.intervalDays).toBe(6)
    expect(s2.repetitions).toBe(2)
    expect(s2.easeFactor).toBeCloseTo(2.7, 10)

    // round(6 * 2.8) = 17 — yeni EF kullanildigi icin 6 * 2.7 = 16 DEGIL.
    const s3 = sm2(s2, 5, NOW)
    expect(s3.intervalDays).toBe(17)
    expect(s3.repetitions).toBe(3)
    expect(s3.easeFactor).toBeCloseTo(2.8, 10)

    // round(17 * 2.9) = 49
    const s4 = sm2(s3, 5, NOW)
    expect(s4.intervalDays).toBe(49)
    expect(s4.repetitions).toBe(4)
    expect(s4.easeFactor).toBeCloseTo(2.9, 10)
  })

  it('EF aralikTAN once guncellenir: ucuncu tekrarda ESKI EF (2.7) degil YENI EF (2.8) kullanilir', () => {
    const s2 = review(initialCardState(NOW), [5, 5], NOW)
    expect(s2.easeFactor).toBeCloseTo(2.7, 10)
    expect(s2.intervalDays).toBe(6)

    const s3 = sm2(s2, 5, NOW)
    expect(s3.intervalDays).toBe(Math.round(6 * 2.8))
    expect(s3.intervalDays).not.toBe(Math.round(6 * 2.7))
  })

  it('puan 3 ve 4 de basarili sayilir; aralik ilerlemesi ayni sirayi izler', () => {
    const passing: ReviewGrade[] = [3, 4]
    for (const grade of passing) {
      const s1 = sm2(initialCardState(NOW), grade, NOW)
      expect(s1.repetitions).toBe(1)
      expect(s1.intervalDays).toBe(1)

      const s2 = sm2(s1, grade, NOW)
      expect(s2.repetitions).toBe(2)
      expect(s2.intervalDays).toBe(6)
    }
  })
})

describe('sm2 — basarisiz tekrar (puan < 3)', () => {
  it.each<[ReviewGrade, number]>([
    [0, 1.7],
    [1, 1.96],
    [2, 2.18],
  ])(
    'puan %i tekrarlari sifirlar, araligi 1 yapar ama EF yine de duser (%f)',
    (grade, expectedEf) => {
      const mature = review(initialCardState(NOW), [5, 5, 5], NOW)
      expect(mature.repetitions).toBe(3)
      expect(mature.intervalDays).toBe(17)

      // Sifirlama olgun bir kart uzerinde dogrulanir: 3 tekrar -> 0, 17 gun -> 1.
      const reset = sm2(mature, grade, NOW)
      expect(reset.repetitions).toBe(0)
      expect(reset.intervalDays).toBe(1)
      expect(reset.nextReviewAt.getTime()).toBe(daysAfter(NOW, 1).getTime())
      // EF dususu onceki EF'ten bagimsizdir: dusus miktari her iki kartta da ayni.
      expect(reset.easeFactor).toBeCloseTo(
        mature.easeFactor + (expectedEf - INITIAL_EASE_FACTOR),
        10,
      )
      expect(reset.easeFactor).toBeLessThan(mature.easeFactor)

      const failed = sm2(initialCardState(NOW), grade, NOW)
      expect(failed.repetitions).toBe(0)
      expect(failed.intervalDays).toBe(1)
      expect(failed.easeFactor).toBeCloseTo(expectedEf, 10)
      expect(failed.easeFactor).toBeLessThan(INITIAL_EASE_FACTOR)
      expect(failed.lastGrade).toBe(grade)
    },
  )

  it('olgunlasmis bir kart basarisiz olunca aralik 1 gune doner', () => {
    const mature = review(initialCardState(NOW), [5, 5, 5, 5], NOW)
    expect(mature.intervalDays).toBe(49)

    const failed = sm2(mature, 2, NOW)
    expect(failed.intervalDays).toBe(1)
    expect(failed.repetitions).toBe(0)
    expect(failed.nextReviewAt.getTime()).toBe(daysAfter(NOW, 1).getTime())
  })
})

describe('sm2 — EF taban degeri', () => {
  it('ust uste 0 puanlari EF degerini 1.3 altina hicbir zaman dusuremez', () => {
    let state = initialCardState(NOW)
    const seen: number[] = []
    for (let i = 0; i < 20; i += 1) {
      state = sm2(state, 0, NOW)
      seen.push(state.easeFactor)
      expect(state.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR)
    }
    expect(seen[0]).toBeCloseTo(1.7, 10)
    // Ikinci basarisizlikta ham deger 0.9'a duserdi; taban devreye girer.
    expect(seen[1]).toBe(1.3)
    expect(seen[19]).toBe(1.3)
  })

  it('taban altinda bozuk bir EF ile gelen kart da 1.3 ile sinirlanir', () => {
    const corrupt: CardState = { ...initialCardState(NOW), easeFactor: 0.4 }
    const next = sm2(corrupt, 5, NOW)
    expect(next.easeFactor).toBe(MIN_EASE_FACTOR)
  })

  it('EF icin ust sinir yoktur: ardarda 5 puanlari EF"i 2.5 uzerine tasir', () => {
    const state = review(initialCardState(NOW), [5, 5, 5, 5, 5, 5], NOW)
    expect(state.easeFactor).toBeGreaterThan(3)
  })
})

describe('sm2 — EF formulu', () => {
  it('tek bir 3 puani sonrasi klasik 2.5 -> 2.36 gecisi', () => {
    const next = sm2(initialCardState(NOW), 3, NOW)
    expect(next.easeFactor).toBeCloseTo(2.36, 10)
  })

  it('4 puani EF degerini degistirmez (delta tam olarak 0)', () => {
    const next = sm2(initialCardState(NOW), 4, NOW)
    expect(next.easeFactor).toBeCloseTo(2.5, 10)
  })

  it('5 puani EF degerini 0.1 artirir', () => {
    const next = sm2(initialCardState(NOW), 5, NOW)
    expect(next.easeFactor).toBeCloseTo(2.6, 10)
  })
})

describe('sm2 — karisik dizi', () => {
  it('5, sonra 0, sonra tekrar 5 verilen kart', () => {
    const s1 = sm2(initialCardState(NOW), 5, NOW)
    expect(s1.easeFactor).toBeCloseTo(2.6, 10)
    expect(s1.repetitions).toBe(1)
    expect(s1.intervalDays).toBe(1)

    const s2 = sm2(s1, 0, NOW)
    expect(s2.easeFactor).toBeCloseTo(1.8, 10)
    expect(s2.repetitions).toBe(0)
    expect(s2.intervalDays).toBe(1)
    expect(s2.lastGrade).toBe(0)

    // Sifirlanan kart yeniden 0. tekrardan basladigi icin aralik yine 1 gun.
    const s3 = sm2(s2, 5, NOW)
    expect(s3.easeFactor).toBeCloseTo(1.9, 10)
    expect(s3.repetitions).toBe(1)
    expect(s3.intervalDays).toBe(1)
  })
})

describe('sm2 — tarih hesabi ve yan etkisizlik', () => {
  it('nextReviewAt tam olarak N gun sonrasidir', () => {
    const s2 = review(initialCardState(NOW), [5, 5], NOW)
    expect(s2.intervalDays).toBe(6)
    expect(s2.nextReviewAt.getTime()).toBe(NOW.getTime() + 6 * MS_PER_DAY)
    expect(s2.nextReviewAt.toISOString()).toBe('2026-03-08T06:00:00.000Z')
  })

  it('now argumani degistirilmez', () => {
    const now = new Date('2026-03-02T09:00:00+03:00')
    const snapshot = now.getTime()
    const iso = now.toISOString()

    sm2(initialCardState(now), 5, now)
    sm2(initialCardState(now), 0, now)

    expect(now.getTime()).toBe(snapshot)
    expect(now.toISOString()).toBe(iso)
  })

  it('donen nextReviewAt uzerinde yapilan degisiklik now"u etkilemez', () => {
    const now = new Date('2026-03-02T09:00:00+03:00')
    const next = sm2(initialCardState(now), 5, now)
    next.nextReviewAt.setFullYear(2099)
    expect(now.toISOString()).toBe('2026-03-02T06:00:00.000Z')
  })

  it('prev nesnesi degistirilmez', () => {
    const prev = review(initialCardState(NOW), [5, 5], NOW)
    const before = {
      easeFactor: prev.easeFactor,
      intervalDays: prev.intervalDays,
      repetitions: prev.repetitions,
      nextReviewAt: prev.nextReviewAt.toISOString(),
      lastGrade: prev.lastGrade,
    }

    sm2(prev, 0, NOW)
    sm2(prev, 5, NOW)

    expect({
      easeFactor: prev.easeFactor,
      intervalDays: prev.intervalDays,
      repetitions: prev.repetitions,
      nextReviewAt: prev.nextReviewAt.toISOString(),
      lastGrade: prev.lastGrade,
    }).toEqual(before)
  })

  it('donen durum prev ile ayni nesne degildir', () => {
    const prev = initialCardState(NOW)
    const next = sm2(prev, 4, NOW)
    expect(next).not.toBe(prev)
    expect(next.nextReviewAt).not.toBe(prev.nextReviewAt)
  })

  it('bozuk kayittan gelen 0 gunluk aralik en az 1 gune yukseltilir', () => {
    const corrupt: CardState = {
      ...initialCardState(NOW),
      intervalDays: 0,
      repetitions: 5,
    }
    const next = sm2(corrupt, 5, NOW)
    expect(next.intervalDays).toBe(1)
    expect(next.nextReviewAt.getTime()).toBe(daysAfter(NOW, 1).getTime())
  })
})

describe('isDue', () => {
  it('gecmis tarihli kart zamani gelmistir', () => {
    expect(isDue(cardAt(daysAfter(NOW, -1)), NOW)).toBe(true)
  })

  it('gelecek tarihli kart zamani gelmemistir', () => {
    expect(isDue(cardAt(daysAfter(NOW, 1)), NOW)).toBe(false)
  })

  it('tam esitlik zamani gelmis sayilir', () => {
    expect(isDue(cardAt(new Date(NOW.getTime())), NOW)).toBe(true)
  })

  it('bir milisaniye sonrasi henuz zamani gelmemistir', () => {
    expect(isDue(cardAt(new Date(NOW.getTime() + 1)), NOW)).toBe(false)
  })

  it('yeni olusturulan kart aninda calisilabilir', () => {
    expect(isDue(initialCardState(NOW), NOW)).toBe(true)
  })
})

describe('selectDueCards', () => {
  type Row = { id: string; state: CardState }

  const rows: Row[] = [
    { id: 'gelecek', state: cardAt(daysAfter(NOW, 3)) },
    { id: 'en-eski', state: cardAt(daysAfter(NOW, -10)) },
    { id: 'bugun', state: cardAt(new Date(NOW.getTime())) },
    { id: 'dun', state: cardAt(daysAfter(NOW, -1)) },
  ]

  it('sadece zamani gelen kartlari doner', () => {
    const result = selectDueCards(rows, NOW, 50)
    expect(result.map((r) => r.id)).toEqual(['en-eski', 'dun', 'bugun'])
  })

  it('en eski nextReviewAt basta olacak sekilde siralar', () => {
    const result = selectDueCards(rows, NOW, 50)
    const times = result.map((r) => r.state.nextReviewAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('esit tarihlerde girdi sirasi korunur (stabil siralama)', () => {
    const same = daysAfter(NOW, -2)
    const tied: Row[] = [
      { id: 'a', state: cardAt(new Date(same.getTime())) },
      { id: 'b', state: cardAt(new Date(same.getTime())) },
      { id: 'c', state: cardAt(new Date(same.getTime())) },
      { id: 'd', state: cardAt(new Date(same.getTime())) },
    ]
    expect(selectDueCards(tied, NOW, 10).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('limit 0 verildiginde bos dizi doner', () => {
    expect(selectDueCards(rows, NOW, 0)).toEqual([])
  })

  it('zamani gelen kart sayisi limitten az ise hepsini doner', () => {
    const result = selectDueCards(rows, NOW, 50)
    expect(result).toHaveLength(3)
  })

  it('zamani gelen kart sayisi limitten fazla ise en eskilerinden limit kadarini doner', () => {
    const result = selectDueCards(rows, NOW, 2)
    expect(result.map((r) => r.id)).toEqual(['en-eski', 'dun'])
  })

  it('limit tam olarak zamani gelen kart sayisina esitse hepsini doner', () => {
    expect(selectDueCards(rows, NOW, 3)).toHaveLength(3)
  })

  it('bos girdi bos sonuc verir', () => {
    expect(selectDueCards<Row>([], NOW, 50)).toEqual([])
  })

  it('hicbir kartin zamani gelmemisse bos sonuc verir', () => {
    const future: Row[] = [
      { id: 'x', state: cardAt(daysAfter(NOW, 1)) },
      { id: 'y', state: cardAt(daysAfter(NOW, 2)) },
    ]
    expect(selectDueCards(future, NOW, 50)).toEqual([])
  })

  it('limit verilmezse gunluk varsayilan kota (50) uygulanir', () => {
    const many: Row[] = Array.from({ length: 80 }, (_, i) => ({
      id: `k${i}`,
      state: cardAt(daysAfter(NOW, -(i + 1))),
    }))
    expect(DEFAULT_DAILY_REVIEW_LIMIT).toBe(50)
    expect(selectDueCards(many, NOW)).toHaveLength(50)
  })

  it('negatif limit 0 gibi davranir', () => {
    expect(selectDueCards(rows, NOW, -5)).toEqual([])
  })

  it('ondalikli limit asagi yuvarlanir', () => {
    expect(selectDueCards(rows, NOW, 2.9)).toHaveLength(2)
  })

  it('NaN limit 0 gibi davranir', () => {
    expect(selectDueCards(rows, NOW, Number.NaN)).toEqual([])
  })

  it('Infinity limit tum zamani gelen kartlari doner', () => {
    expect(selectDueCards(rows, NOW, Number.POSITIVE_INFINITY)).toHaveLength(3)
  })

  it('girdi dizisini ve icindeki nesneleri degistirmez', () => {
    const input: Row[] = [
      { id: 'p', state: cardAt(daysAfter(NOW, -1)) },
      { id: 'q', state: cardAt(daysAfter(NOW, -2)) },
    ]
    const order = input.map((r) => r.id)
    selectDueCards(input, NOW, 1)
    expect(input.map((r) => r.id)).toEqual(order)
    expect(input).toHaveLength(2)
  })

  it('donen elemanlar girdideki nesnelerin ta kendisidir (kopya degil)', () => {
    const input: Row[] = [{ id: 'p', state: cardAt(daysAfter(NOW, -1)) }]
    const result = selectDueCards(input, NOW, 5)
    expect(result[0]).toBe(input[0])
  })

  it('seyrek dizideki bosluklari atlar', () => {
    const sparse: Row[] = []
    sparse[0] = { id: 'ilk', state: cardAt(daysAfter(NOW, -2)) }
    sparse[3] = { id: 'son', state: cardAt(daysAfter(NOW, -1)) }
    expect(sparse).toHaveLength(4)
    expect(selectDueCards(sparse, NOW, 50).map((r) => r.id)).toEqual(['ilk', 'son'])
  })

  it('sm2 ile uretilen gercek kart akisiyla calisir', () => {
    const learned = sm2(initialCardState(NOW), 5, NOW) // 1 gun sonra
    const failed = sm2(initialCardState(NOW), 1, NOW) // 1 gun sonra
    const deck: Row[] = [
      { id: 'ogrenildi', state: learned },
      { id: 'basarisiz', state: failed },
    ]

    expect(selectDueCards(deck, NOW, 50)).toEqual([])
    const tomorrow = daysAfter(NOW, 1)
    expect(selectDueCards(deck, tomorrow, 50).map((r) => r.id)).toEqual(['ogrenildi', 'basarisiz'])
  })
})
