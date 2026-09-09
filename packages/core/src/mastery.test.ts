import { describe, it, expect } from 'vitest'

import {
  DEFAULT_EXPECTED_SECONDS,
  calculateMastery,
  classifyMastery,
  rankPriorityTopics,
} from './mastery'
import type { AttemptLike, MasteryEntry, TopicLike } from './types'

/** Sabit referans an — testler sistem saatinden bagimsiz olmali. */
const BASE = new Date('2026-03-02T09:00:00+03:00')
const HOUR_MS = 60 * 60 * 1000

/**
 * Varsayilan deneme: zorluk 1, beklenen sure 80 sn (60 + 20 * 1), harcanan 80 sn.
 * Yani oran = 1 -> hiz katsayisi tam 1.00; boylece hiz disindaki etkenler yalitilir.
 * `index` 0 = EN ESKI deneme; her deneme bir saat sonrasina yazilir.
 */
function makeAttempt(index: number, overrides: Partial<AttemptLike> = {}): AttemptLike {
  return {
    questionId: `q${index}`,
    isCorrect: true,
    difficulty: 1,
    timeSpentMs: 80_000,
    expectedSeconds: null,
    answeredAt: new Date(BASE.getTime() + index * HOUR_MS),
    ...overrides,
  }
}

function makeAttempts(
  count: number,
  overrides: (index: number) => Partial<AttemptLike> = () => ({}),
): AttemptLike[] {
  return Array.from({ length: count }, (_, index) => makeAttempt(index, overrides(index)))
}

function makeTopic(id: string, overrides: Partial<TopicLike> = {}): TopicLike {
  return {
    id,
    subjectId: 'matematik',
    unitId: 'unite-1',
    title: `Konu ${id}`,
    orderIndex: 1,
    estimatedMinutes: 40,
    difficulty: 3,
    examWeight: 0.5,
    ...overrides,
  }
}

function makeEntry(topicId: string, overrides: Partial<MasteryEntry> = {}): MasteryEntry {
  return {
    topicId,
    mastery: 50,
    status: 'medium',
    attemptsCount: 10,
    ...overrides,
  }
}

describe('DEFAULT_EXPECTED_SECONDS', () => {
  it('beklenen sureyi 60 + 20 * zorluk olarak hesaplar', () => {
    expect(DEFAULT_EXPECTED_SECONDS(1)).toBe(80)
    expect(DEFAULT_EXPECTED_SECONDS(3)).toBe(120)
    expect(DEFAULT_EXPECTED_SECONDS(5)).toBe(160)
  })

  it('aralik disi zorlugu 1-5 arasina kirpar', () => {
    expect(DEFAULT_EXPECTED_SECONDS(0)).toBe(80)
    expect(DEFAULT_EXPECTED_SECONDS(-4)).toBe(80)
    expect(DEFAULT_EXPECTED_SECONDS(9)).toBe(160)
  })
})

describe('calculateMastery — veri yetersizligi', () => {
  it('bos dizide notr onsel doner: 35 / unknown / n=0', () => {
    expect(calculateMastery([])).toEqual({ mastery: 35, status: 'unknown', n: 0 })
  })

  it('tek deneme notr onsele yakin kalir ve unknown doner', () => {
    const result = calculateMastery(makeAttempts(1))
    expect(result.n).toBe(1)
    expect(result.status).toBe('unknown')
    // guven = 1/8 -> sonuc agirlikli olarak 35 onseline yakin
    expect(result.mastery).toBe(42)
  })

  it('iki deneme hala unknown kalir', () => {
    const result = calculateMastery(makeAttempts(2))
    expect(result.n).toBe(2)
    expect(result.status).toBe('unknown')
  })

  it('tam 3 deneme unknown durumundan cikar', () => {
    const result = calculateMastery(makeAttempts(3))
    expect(result.n).toBe(3)
    expect(result.status).not.toBe('unknown')
    expect(result.mastery).toBe(56)
  })

  it('tam 8 denemede guven 1.0 olur ve onsel karisimi biter', () => {
    const seven = calculateMastery(makeAttempts(7, () => ({ isCorrect: false })))
    const eight = calculateMastery(makeAttempts(8, () => ({ isCorrect: false })))
    // 7 denemede onselin %12.5'i hala sizar; 8'de tamamen kaybolur
    expect(seven.mastery).toBe(4)
    expect(eight.mastery).toBe(0)
    expect(eight.status).toBe('weak')
  })
})

describe('calculateMastery — pencere secimi', () => {
  it('tam 30 denemenin hepsini hesaba katar', () => {
    const result = calculateMastery(makeAttempts(30))
    expect(result.n).toBe(30)
  })

  it('45 denemede yalnizca en yeni 30 deneme kullanilir', () => {
    // En eski 15 deneme yanlis, en yeni 30 deneme dogru
    const attempts = makeAttempts(45, (i) => ({ isCorrect: i >= 15 }))
    const result = calculateMastery(attempts)
    expect(result.n).toBe(30)
    // Pencere disindaki yanlislar hesabi hic etkilemez: acc = 0.9, hiz = 1, guven = 1
    expect(result.mastery).toBe(90)
    expect(result.status).toBe('strong')
  })

  it('girdi sirasi karisik olsa da ayni sonucu uretir', () => {
    const attempts = makeAttempts(45, (i) => ({ isCorrect: i >= 15 }))
    const shuffled = [...attempts].reverse()
    expect(calculateMastery(shuffled)).toEqual(calculateMastery(attempts))
  })

  it('answeredAt ISO string olarak verilebilir', () => {
    const withDates = makeAttempts(12, (i) => ({ isCorrect: i % 3 !== 0 }))
    const withStrings = withDates.map((attempt) => ({
      ...attempt,
      answeredAt:
        attempt.answeredAt instanceof Date ? attempt.answeredAt.toISOString() : attempt.answeredAt,
    }))
    expect(calculateMastery(withStrings)).toEqual(calculateMastery(withDates))
  })
})

describe('calculateMastery — dogruluk', () => {
  it('zorluk 5 ve hepsi dogru ise puan 100 ile sinirlanir', () => {
    const attempts = makeAttempts(8, () => ({ difficulty: 5, timeSpentMs: 160_000 }))
    const result = calculateMastery(attempts)
    // ham deger 100 * 1.3 -> once acc 1.0'a, sonra puan 100'e kirpilir
    expect(result.mastery).toBe(100)
    expect(result.status).toBe('strong')
  })

  it('hepsi yanlis ise puan 0 ve zayif olur', () => {
    const result = calculateMastery(makeAttempts(10, () => ({ isCorrect: false })))
    expect(result.mastery).toBe(0)
    expect(result.status).toBe('weak')
  })

  it('karisik sonuclarda 0 ile 100 arasinda ara bir deger uretir', () => {
    // En yeni deneme dogru olacak sekilde donusumlu dogru/yanlis
    const result = calculateMastery(makeAttempts(8, (i) => ({ isCorrect: i % 2 === 1 })))
    expect(result.mastery).toBe(47)
    expect(result.status).toBe('weak')
  })

  it('dogru sayisi arttikca puan artar', () => {
    const few = calculateMastery(makeAttempts(10, (i) => ({ isCorrect: i >= 8 })))
    const many = calculateMastery(makeAttempts(10, (i) => ({ isCorrect: i >= 2 })))
    expect(many.mastery).toBeGreaterThan(few.mastery)
  })

  it('guncel denemeler eski denemelerden daha agirlikli sayilir', () => {
    const improving = calculateMastery(makeAttempts(20, (i) => ({ isCorrect: i >= 10 })))
    const declining = calculateMastery(makeAttempts(20, (i) => ({ isCorrect: i < 10 })))
    expect(improving.mastery).toBeGreaterThan(declining.mastery)
  })

  it('zorluk 1-5 disindaysa kirpilir', () => {
    const hard = calculateMastery(makeAttempts(3, () => ({ difficulty: 5, timeSpentMs: 160_000 })))
    const tooHard = calculateMastery(
      makeAttempts(3, () => ({ difficulty: 9, timeSpentMs: 160_000 })),
    )
    const easy = calculateMastery(makeAttempts(3, () => ({ difficulty: 1 })))
    const tooEasy = calculateMastery(makeAttempts(3, () => ({ difficulty: 0 })))
    expect(tooHard.mastery).toBe(hard.mastery)
    expect(tooEasy.mastery).toBe(easy.mastery)
    expect(hard.mastery).toBe(59)
    expect(easy.mastery).toBe(56)
  })
})

describe('calculateMastery — hiz katsayisi', () => {
  it('timeSpentMs 0 oldugunda hiz katsayisi 1.15 ile sinirlanir', () => {
    const result = calculateMastery(makeAttempts(3, () => ({ timeSpentMs: 0 })))
    expect(result.mastery).toBe(61)
  })

  it('asiri yavas cozumde hiz katsayisi 0.85 ile sinirlanir', () => {
    // oran 20 -> 1.15 - 3.0 = -1.85, alt sinira kirpilir
    const slow = calculateMastery(makeAttempts(3, () => ({ timeSpentMs: 1_600_000 })))
    const absurd = calculateMastery(makeAttempts(3, () => ({ timeSpentMs: 8_000_000 })))
    expect(slow.mastery).toBe(51)
    expect(absurd.mastery).toBe(slow.mastery)
  })

  it('normal hizda (oran 1) katsayi tam 1.00 olur', () => {
    const normal = calculateMastery(makeAttempts(3))
    const fast = calculateMastery(makeAttempts(3, () => ({ timeSpentMs: 0 })))
    const slow = calculateMastery(makeAttempts(3, () => ({ timeSpentMs: 1_600_000 })))
    expect(normal.mastery).toBe(56)
    expect(fast.mastery).toBeGreaterThan(normal.mastery)
    expect(slow.mastery).toBeLessThan(normal.mastery)
  })

  it('cift sayida denemede medyan iki ortanca oranin ortalamasidir', () => {
    // Oranlar 0.2 / 0.4 / 0.6 / 0.8 -> medyan 0.5 -> hiz 1.075
    const spent = [16_000, 32_000, 48_000, 64_000]
    const attempts = makeAttempts(4, (i) => ({ timeSpentMs: spent[i] ?? 0 }))
    expect(calculateMastery(attempts).mastery).toBe(66)
  })

  it('tek uc yavas deneme medyani bozmaz', () => {
    const withOutlier = calculateMastery(
      makeAttempts(5, (i) => ({ timeSpentMs: i === 2 ? 4_000_000 : 80_000 })),
    )
    const withoutOutlier = calculateMastery(makeAttempts(5))
    expect(withOutlier.mastery).toBe(withoutOutlier.mastery)
  })

  it('expectedSeconds null oldugunda 60 + 20 * zorluk varsayilir', () => {
    const fallback = calculateMastery(makeAttempts(3, () => ({ expectedSeconds: null })))
    const explicit = calculateMastery(makeAttempts(3, () => ({ expectedSeconds: 80 })))
    expect(fallback.mastery).toBe(explicit.mastery)
  })

  it('expectedSeconds 0 veya negatif oldugunda da varsayilan kullanilir', () => {
    const zero = calculateMastery(makeAttempts(3, () => ({ expectedSeconds: 0 })))
    const negative = calculateMastery(makeAttempts(3, () => ({ expectedSeconds: -30 })))
    const fallback = calculateMastery(makeAttempts(3, () => ({ expectedSeconds: null })))
    expect(zero.mastery).toBe(fallback.mastery)
    expect(negative.mastery).toBe(fallback.mastery)
  })

  it('gecerli expectedSeconds verildiginde varsayilan yerine o kullanilir', () => {
    // Beklenen 160 sn, harcanan 80 sn -> oran 0.5 -> daha hizli sayilir
    const generous = calculateMastery(makeAttempts(3, () => ({ expectedSeconds: 160 })))
    const fallback = calculateMastery(makeAttempts(3, () => ({ expectedSeconds: null })))
    expect(generous.mastery).toBeGreaterThan(fallback.mastery)
  })
})

describe('calculateMastery — tekrar cezasi', () => {
  it('ayni soru 4 kez cozuldugunde sonraki uc cozum 0.3 agirlikla girer', () => {
    // En eski cozum dogru, sonraki uc cozum yanlis
    const repeated = calculateMastery(
      makeAttempts(4, (i) => ({ questionId: 'ayni-soru', isCorrect: i === 0 })),
    )
    const distinct = calculateMastery(makeAttempts(4, (i) => ({ isCorrect: i === 0 })))
    expect(repeated.mastery).toBe(40)
    expect(distinct.mastery).toBe(28)
    // Ezberleme etkisi kirildigi icin tekrar eden yanlislarin agirligi dusuk kalir
    expect(repeated.mastery).toBeGreaterThan(distinct.mastery)
  })

  it('ayni soru arka arkaya 3 kez cozuldugunde yalnizca ilki tam agirlik alir', () => {
    // Ilk cozum yanlis, sonraki ikisi dogru: ezberlenen dogrular puani sisiremez
    const repeated = calculateMastery(
      makeAttempts(3, (i) => ({ questionId: 'ayni-soru', isCorrect: i > 0 })),
    )
    const distinct = calculateMastery(makeAttempts(3, (i) => ({ isCorrect: i > 0 })))
    expect(repeated.mastery).toBeLessThan(distinct.mastery)
  })

  it('repeatIndex verildiginde kullanilir, verilmediginde listeden turetilir', () => {
    const derived = calculateMastery(
      makeAttempts(4, (i) => ({ questionId: 'ayni-soru', isCorrect: i === 0 })),
    )
    const provided = calculateMastery(
      makeAttempts(4, (i) => ({ questionId: 'ayni-soru', isCorrect: i === 0, repeatIndex: i })),
    )
    expect(provided.mastery).toBe(derived.mastery)
  })

  it('repeatIndex 0 verilen tekrarlar tam agirlikla girer', () => {
    const allFirst = calculateMastery(
      makeAttempts(4, (i) => ({ questionId: 'ayni-soru', isCorrect: i === 0, repeatIndex: 0 })),
    )
    const distinct = calculateMastery(makeAttempts(4, (i) => ({ isCorrect: i === 0 })))
    expect(allFirst.mastery).toBe(distinct.mastery)
  })

  it('farkli sorularin tekrarlari birbirini etkilemez', () => {
    const attempts = makeAttempts(4, (i) => ({ questionId: i % 2 === 0 ? 'a' : 'b' }))
    const result = calculateMastery(attempts)
    expect(result.n).toBe(4)
    // a ve b'nin ilk cozumleri tam, ikinci cozumleri dusuk agirlikli
    expect(result.mastery).toBeGreaterThan(0)
  })
})

describe('classifyMastery', () => {
  it('3 denemenin altinda her zaman unknown doner', () => {
    expect(classifyMastery(0, 0)).toBe('unknown')
    expect(classifyMastery(100, 1)).toBe('unknown')
    expect(classifyMastery(60, 2)).toBe('unknown')
  })

  it('0-49 araligi zayif sayilir', () => {
    expect(classifyMastery(0, 3)).toBe('weak')
    expect(classifyMastery(49, 3)).toBe('weak')
  })

  it('50-74 araligi orta sayilir', () => {
    expect(classifyMastery(50, 3)).toBe('medium')
    expect(classifyMastery(74, 3)).toBe('medium')
  })

  it('75-100 araligi guclu sayilir', () => {
    expect(classifyMastery(75, 3)).toBe('strong')
    expect(classifyMastery(100, 30)).toBe('strong')
  })
})

describe('rankPriorityTopics', () => {
  const topicA = makeTopic('a', { orderIndex: 1, difficulty: 5, examWeight: 0.4 })
  const topicB = makeTopic('b', { orderIndex: 2, difficulty: 1, examWeight: 1 })
  const topicC = makeTopic('c', { orderIndex: 3, difficulty: 3, examWeight: 0.5 })

  it('oncelik formulunu uygular ve azalan siralar', () => {
    const masteries = [
      makeEntry('a', { mastery: 20, status: 'weak' }),
      makeEntry('b', { mastery: 90, status: 'strong' }),
      makeEntry('c', { mastery: 35, status: 'unknown' }),
    ]
    const ranked = rankPriorityTopics(masteries, [topicA, topicB, topicC])
    expect(ranked.map((item) => item.topic.id)).toEqual(['a', 'c', 'b'])
    expect(ranked[0]?.priority).toBeCloseTo(64, 10)
    expect(ranked[1]?.priority).toBeCloseTo(52, 10)
    expect(ranked[2]?.priority).toBeCloseTo(12, 10)
  })

  it('yetkinlik kaydi olmayan konu 35 / unknown notr onseliyle degerlendirilir', () => {
    const ranked = rankPriorityTopics([], [topicC])
    expect(ranked[0]?.mastery).toBe(35)
    expect(ranked[0]?.status).toBe('unknown')
    expect(ranked[0]?.priority).toBeCloseTo(52, 10)
  })

  it('kayitli puan ve durum oldugu gibi tasinir', () => {
    const ranked = rankPriorityTopics([makeEntry('c', { mastery: 88, status: 'strong' })], [topicC])
    expect(ranked[0]?.mastery).toBe(88)
    expect(ranked[0]?.status).toBe('strong')
  })

  it('esit oncelikte orderIndex artan siralanir', () => {
    const late = makeTopic('z', { orderIndex: 9 })
    const early = makeTopic('y', { orderIndex: 2 })
    const ranked = rankPriorityTopics([], [late, early])
    expect(ranked.map((item) => item.topic.id)).toEqual(['y', 'z'])
  })

  it('tum konulari doner, kirpma yapmaz', () => {
    const topics = Array.from({ length: 25 }, (_, i) => makeTopic(`t${i}`, { orderIndex: i }))
    expect(rankPriorityTopics([], topics)).toHaveLength(25)
  })

  it('bos konu listesinde bos dizi doner', () => {
    expect(rankPriorityTopics([makeEntry('a')], [])).toEqual([])
  })

  it('ilgisiz yetkinlik kayitlari siralamayi bozmaz', () => {
    const ranked = rankPriorityTopics([makeEntry('bilinmeyen', { mastery: 0 })], [topicC])
    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.mastery).toBe(35)
  })

  it('ayni konu icin birden fazla kayit gelirse ilki kullanilir', () => {
    const ranked = rankPriorityTopics(
      [makeEntry('c', { mastery: 10 }), makeEntry('c', { mastery: 95 })],
      [topicC],
    )
    expect(ranked[0]?.mastery).toBe(10)
  })

  it('sinav agirligi 0 olan konu en sona duser', () => {
    const irrelevant = makeTopic('sifir', { orderIndex: 0, examWeight: 0 })
    const ranked = rankPriorityTopics([], [irrelevant, topicC])
    expect(ranked.map((item) => item.topic.id)).toEqual(['c', 'sifir'])
    expect(ranked[1]?.priority).toBe(0)
  })
})

describe('calculateMastery — bozuk girdilere dayaniklilik', () => {
  it('sayisal olmayan timeSpentMs 0 sure sayilir', () => {
    const broken = calculateMastery(makeAttempts(3, () => ({ timeSpentMs: Number.NaN })))
    const zero = calculateMastery(makeAttempts(3, () => ({ timeSpentMs: 0 })))
    expect(broken.mastery).toBe(zero.mastery)
  })

  it('negatif timeSpentMs 0 sure sayilir', () => {
    const negative = calculateMastery(makeAttempts(3, () => ({ timeSpentMs: -5_000 })))
    expect(negative.mastery).toBe(61)
  })

  it('sayisal olmayan zorluk en dusuk zorluk kabul edilir', () => {
    const broken = calculateMastery(makeAttempts(3, () => ({ difficulty: Number.NaN })))
    const easiest = calculateMastery(makeAttempts(3, () => ({ difficulty: 1 })))
    expect(broken.mastery).toBe(easiest.mastery)
  })

  it('gecersiz answeredAt hesabi kirmaz, en eski deneme sayilir', () => {
    const attempts = makeAttempts(31, (i) => (i === 30 ? { answeredAt: 'gecersiz-tarih' } : {}))
    const result = calculateMastery(attempts)
    expect(result.n).toBe(30)
    expect(Number.isInteger(result.mastery)).toBe(true)
  })

  it('ayni zaman damgasinda girdi sirasi belirleyicidir', () => {
    const sameMoment = makeAttempts(4, (i) => ({ answeredAt: BASE, isCorrect: i === 0 }))
    const first = calculateMastery(sameMoment)
    const second = calculateMastery([...sameMoment])
    expect(first).toEqual(second)
    expect(first.n).toBe(4)
  })

  it('gecersiz repeatIndex verildiginde deger listeden turetilir', () => {
    const broken = calculateMastery(
      makeAttempts(4, (i) => ({
        questionId: 'ayni-soru',
        isCorrect: i === 0,
        repeatIndex: Number.NaN,
      })),
    )
    const derived = calculateMastery(
      makeAttempts(4, (i) => ({ questionId: 'ayni-soru', isCorrect: i === 0 })),
    )
    expect(broken.mastery).toBe(derived.mastery)
  })

  it('sayisal olmayan puan siniflandirilamaz', () => {
    expect(classifyMastery(Number.NaN, 10)).toBe('unknown')
  })
})

describe('calculateMastery ve classifyMastery tutarliligi', () => {
  it('sonuctaki status, puan ve n ile classifyMastery ciktisina esittir', () => {
    const cases: AttemptLike[][] = [
      [],
      makeAttempts(2),
      makeAttempts(5, (i) => ({ isCorrect: i % 2 === 0 })),
      makeAttempts(12, () => ({ isCorrect: false })),
      makeAttempts(30, () => ({ difficulty: 5, timeSpentMs: 160_000 })),
    ]
    for (const attempts of cases) {
      const result = calculateMastery(attempts)
      expect(result.status).toBe(classifyMastery(result.mastery, result.n))
      expect(result.mastery).toBeGreaterThanOrEqual(0)
      expect(result.mastery).toBeLessThanOrEqual(100)
      expect(Number.isInteger(result.mastery)).toBe(true)
    }
  })
})
