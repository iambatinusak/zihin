import { describe, it, expect } from 'vitest'

import { generateStudyPlan } from './studyPlan'
import type { MasteryEntry, MasteryStatus, PlanInput, StudyBlockDraft, TopicLike } from './types'

// ---------------------------------------------------------------------------
// Sabit tarihler ve yardimcilar
// ---------------------------------------------------------------------------

/** 2026-03-02 Pazartesi. */
const START = new Date('2026-03-02T09:00:00+03:00')
/** 2026-06-15 — baslangictan 105 gun (15 hafta) sonra. */
const EXAM = new Date('2026-06-15T09:00:00+03:00')

const DAY_MS = 24 * 60 * 60 * 1000

const WARNING_EXAM_PASSED = 'Sınav tarihi geçmiş görünüyor. Ayarlardan güncelleyin.'
const WARNING_TIGHT = 'Program yoğun, günlük çalışma süresini artırmayı düşünün.'
const WARNING_STRONG_DROPPED = 'Zaman kısıtlı olduğu için güçlü konular programa alınmadı.'
const WARNING_NO_STUDY_DAYS = 'Çalışma günü seçilmedi, program oluşturulamadı.'
const WARNING_OVERSIZED =
  'Bazı konular günlük sürenize sığmıyor; günlük çalışma süresini artırmayı düşünün.'

function makeTopic(id: string, over: Partial<TopicLike> = {}): TopicLike {
  return {
    id,
    subjectId: 'mat',
    unitId: 'u1',
    title: `Konu ${id}`,
    orderIndex: 0,
    estimatedMinutes: 20,
    difficulty: 3,
    examWeight: 0.5,
    ...over,
  }
}

function makeMastery(topicId: string, mastery: number, status: MasteryStatus): MasteryEntry {
  return { topicId, mastery, status, attemptsCount: 10 }
}

function makeInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    startDate: START,
    examDate: EXAM,
    dailyMinutes: 120,
    studyDays: [1, 2, 3, 4, 5],
    topics: [makeTopic('t1', { title: 'Sayi Basamaklari' })],
    masteries: [],
    ...over,
  }
}

/** "YYYY-MM-DD" -> epoch gun numarasi. */
function toDayNumber(dateStr: string): number {
  const parts = dateStr.split('-')
  const year = Number(parts[0] ?? 0)
  const month = Number(parts[1] ?? 1)
  const day = Number(parts[2] ?? 1)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

/** ISO hafta gunu: 1 = Pazartesi ... 7 = Pazar. */
function isoWeekdayOf(dateStr: string): number {
  return ((((toDayNumber(dateStr) + 3) % 7) + 7) % 7) + 1
}

function groupByDate(blocks: StudyBlockDraft[]): Map<string, StudyBlockDraft[]> {
  const map = new Map<string, StudyBlockDraft[]>()
  for (const block of blocks) {
    const list = map.get(block.scheduledDate)
    if (list) list.push(block)
    else map.set(block.scheduledDate, [block])
  }
  return map
}

function blocksOfTopic(blocks: StudyBlockDraft[], topicId: string): StudyBlockDraft[] {
  return blocks.filter((block) => block.topicId === topicId)
}

// ---------------------------------------------------------------------------

describe('generateStudyPlan — temel davranis', () => {
  it('tek konu icin izle, coz, tekrar ve haftalik deneme bloklarini uretir', () => {
    const result = generateStudyPlan(makeInput())

    expect(result.blocks.map((b) => b.type)).toEqual(['watch', 'solve', 'review', 'mock'])
    expect(result.blocks.map((b) => b.title)).toEqual([
      'İzle: Sayi Basamaklari',
      'Çöz: Sayi Basamaklari testi',
      'Tekrar: Sayi Basamaklari kartları',
      'Haftalık Mini Deneme',
    ])
    expect(result.blocks.map((b) => b.scheduledDate)).toEqual([
      '2026-03-02',
      '2026-03-02',
      '2026-03-04',
      '2026-03-06',
    ])
    expect(result.warnings).toEqual([])
  })

  it('blok sureleri sozlesmeye uyar: izle=konu suresi, coz=15, tekrar=5, deneme=30', () => {
    const result = generateStudyPlan(
      makeInput({ topics: [makeTopic('t1', { estimatedMinutes: 42 })] }),
    )
    const minutesByType = new Map(result.blocks.map((b) => [b.type, b.estimatedMinutes]))

    expect(minutesByType.get('watch')).toBe(42)
    expect(minutesByType.get('solve')).toBe(15)
    expect(minutesByType.get('review')).toBe(5)
    expect(minutesByType.get('mock')).toBe(30)
  })

  it('istatistikleri doldurur (konu sayisi, toplam dakika, haftalik butce, kalan hafta)', () => {
    const result = generateStudyPlan(makeInput())

    expect(result.stats).toEqual({
      topicCount: 1,
      totalMinutes: 20 + 15 + 5 + 30,
      weeklyBudgetMinutes: 120 * 5,
      weeksRemaining: 15,
    })
  })

  it('orderIndex her gun 0 dan baslar ve birer birer artar', () => {
    const topics = Array.from({ length: 8 }, (_, i) =>
      makeTopic(`t${i}`, { orderIndex: i, estimatedMinutes: 20 }),
    )
    const result = generateStudyPlan(makeInput({ topics, dailyMinutes: 200 }))

    for (const [, dayBlocks] of groupByDate(result.blocks)) {
      expect(dayBlocks.map((b) => b.orderIndex)).toEqual(dayBlocks.map((_, i) => i))
    }
  })

  it('haftalik deneme blogu gununun son blogudur ve konusuzdur', () => {
    const result = generateStudyPlan(makeInput())
    const mock = result.blocks.find((b) => b.type === 'mock')

    expect(mock).toBeDefined()
    expect(mock?.topicId).toBeNull()
    expect(mock?.estimatedMinutes).toBe(30)
    expect(mock?.scheduledDate).toBe('2026-03-06')

    const sameDay = result.blocks.filter((b) => b.scheduledDate === mock?.scheduledDate)
    expect(sameDay[sameDay.length - 1]?.type).toBe('mock')
  })
})

describe('generateStudyPlan — sinav tarihi kenar durumlari', () => {
  it('sinav tarihi gecmisse uyari verir ve programi tek haftaya sikistirir', () => {
    const result = generateStudyPlan(
      makeInput({
        examDate: new Date('2026-01-10T09:00:00+03:00'),
        weeks: 4,
        topics: [makeTopic('zayif'), makeTopic('guclu')],
        masteries: [makeMastery('zayif', 30, 'weak'), makeMastery('guclu', 90, 'strong')],
      }),
    )

    expect(result.warnings).toContain(WARNING_EXAM_PASSED)
    expect(result.stats.weeksRemaining).toBe(0)
    expect(result.blocks.length).toBeGreaterThan(0)
    for (const block of result.blocks) {
      expect(block.scheduledDate <= '2026-03-08').toBe(true)
    }
  })

  it('sinav yarinsa sadece bugun ve yarin programlanir', () => {
    const result = generateStudyPlan(makeInput({ examDate: new Date('2026-03-03T09:00:00+03:00') }))

    expect(result.stats.weeksRemaining).toBe(1)
    expect(result.blocks.length).toBeGreaterThan(0)
    for (const block of result.blocks) {
      expect(block.scheduledDate >= '2026-03-02').toBe(true)
      expect(block.scheduledDate <= '2026-03-03').toBe(true)
    }
  })

  it('sinav 40 hafta uzaktaysa kalan hafta 40 olur ve yogunluk uyarisi cikmaz', () => {
    const result = generateStudyPlan(makeInput({ examDate: new Date('2026-12-07T09:00:00+03:00') }))

    expect(result.stats.weeksRemaining).toBe(40)
    expect(result.warnings).toEqual([])
  })

  it('sinav gunu araligin ust sinirini belirler, sonrasina blok koymaz', () => {
    const result = generateStudyPlan(
      makeInput({
        examDate: new Date('2026-03-04T09:00:00+03:00'),
        weeks: 2,
        topics: Array.from({ length: 6 }, (_, i) => makeTopic(`t${i}`, { orderIndex: i })),
      }),
    )

    for (const block of result.blocks) {
      expect(block.scheduledDate <= '2026-03-04').toBe(true)
    }
  })
})

describe('generateStudyPlan — calisma gunleri', () => {
  it('calisma gunu secilmediyse bos program ve uyari doner', () => {
    const result = generateStudyPlan(makeInput({ studyDays: [] }))

    expect(result.blocks).toEqual([])
    expect(result.warnings).toEqual([WARNING_NO_STUDY_DAYS])
    expect(result.stats).toEqual({
      topicCount: 0,
      totalMinutes: 0,
      weeklyBudgetMinutes: 0,
      weeksRemaining: 15,
    })
  })

  it('sadece pazar secildiginde tum bloklar pazar gunune duser', () => {
    const result = generateStudyPlan(makeInput({ studyDays: [7] }))

    expect(result.blocks.length).toBeGreaterThan(0)
    for (const block of result.blocks) {
      expect(block.scheduledDate).toBe('2026-03-08')
      expect(isoWeekdayOf(block.scheduledDate)).toBe(7)
    }
  })

  it('tekrarli ve gecersiz gun degerleri temizlenir ([1,1,9] -> sadece pazartesi)', () => {
    const result = generateStudyPlan(makeInput({ studyDays: [1, 1, 9] }))

    expect(result.blocks.length).toBeGreaterThan(0)
    expect(new Set(result.blocks.map((b) => b.scheduledDate))).toEqual(new Set(['2026-03-02']))
    expect(result.stats.weeklyBudgetMinutes).toBe(120)
  })

  it('gecersiz gunler tamamen elenirse calisma gunu yok kabul edilir', () => {
    const result = generateStudyPlan(makeInput({ studyDays: [0, 8, 3.5] }))

    expect(result.blocks).toEqual([])
    expect(result.warnings).toContain(WARNING_NO_STUDY_DAYS)
  })

  it('her scheduledDate izin verilen gunlerde ve [startDate, examDate] araliginda kalir', () => {
    const topics = Array.from({ length: 20 }, (_, i) =>
      makeTopic(`t${i}`, { orderIndex: i, subjectId: `s${i % 3}` }),
    )
    const result = generateStudyPlan(
      makeInput({ topics, studyDays: [2, 4, 6], weeks: 3, dailyMinutes: 90 }),
    )

    expect(result.blocks.length).toBeGreaterThan(0)
    for (const block of result.blocks) {
      expect([2, 4, 6]).toContain(isoWeekdayOf(block.scheduledDate))
      expect(block.scheduledDate >= '2026-03-02').toBe(true)
      expect(block.scheduledDate <= '2026-06-15').toBe(true)
    }
  })

  it('baslangic tarihinden onceki gunlere blok koymaz', () => {
    // 2026-03-04 Carsamba; ayni haftanin pazartesi/sali gunleri disarida kalmali.
    const result = generateStudyPlan(
      makeInput({
        startDate: new Date('2026-03-04T09:00:00+03:00'),
        topics: Array.from({ length: 5 }, (_, i) => makeTopic(`t${i}`, { orderIndex: i })),
      }),
    )

    expect(result.blocks.length).toBeGreaterThan(0)
    for (const block of result.blocks) {
      expect(block.scheduledDate >= '2026-03-04').toBe(true)
    }
  })
})

describe('generateStudyPlan — gunluk butce ve kapasite', () => {
  it('gunluk toplam sure gunluk butceyi asmaz', () => {
    const topics = Array.from({ length: 12 }, (_, i) =>
      makeTopic(`t${i}`, { orderIndex: i, estimatedMinutes: 25, subjectId: `s${i % 3}` }),
    )
    const result = generateStudyPlan(makeInput({ topics, dailyMinutes: 100 }))

    for (const [, dayBlocks] of groupByDate(result.blocks)) {
      const total = dayBlocks.reduce((sum, b) => sum + b.estimatedMinutes, 0)
      expect(total).toBeLessThanOrEqual(100)
    }
  })

  it('gunluk butceye sigmayan konu (30 dk butce, 45 dk konu) yine de tek basina programlanir', () => {
    const result = generateStudyPlan(
      makeInput({
        dailyMinutes: 30,
        topics: [makeTopic('t1', { estimatedMinutes: 45, title: 'Turev' })],
      }),
    )

    const watch = result.blocks.find((b) => b.type === 'watch')
    expect(watch?.scheduledDate).toBe('2026-03-02')
    expect(watch?.estimatedMinutes).toBe(45)

    const sameDay = result.blocks.filter((b) => b.scheduledDate === '2026-03-02')
    expect(sameDay).toHaveLength(1)
    expect(result.warnings).toContain(WARNING_OVERSIZED)
  })

  it('gunde en fazla 3 farkli ders bulunur', () => {
    const topics = Array.from({ length: 12 }, (_, i) =>
      makeTopic(`t${i}`, { orderIndex: i, subjectId: `s${i % 6}`, estimatedMinutes: 20 }),
    )
    const result = generateStudyPlan(makeInput({ topics, dailyMinutes: 240 }))
    const subjectOf = new Map(topics.map((t) => [t.id, t.subjectId]))

    let maxSubjects = 0
    for (const [, dayBlocks] of groupByDate(result.blocks)) {
      const subjects = new Set<string>()
      for (const block of dayBlocks) {
        const subject = block.topicId === null ? null : subjectOf.get(block.topicId)
        if (subject) subjects.add(subject)
      }
      expect(subjects.size).toBeLessThanOrEqual(3)
      maxSubjects = Math.max(maxSubjects, subjects.size)
    }
    // Kural gercekten baglayici olmali, aksi halde test hicbir sey kanitlamaz.
    expect(maxSubjects).toBe(3)
  })

  it('60 konu ve dar butce ile sonsuz donguye girmez, yogunluk uyarisi verir', () => {
    const topics = Array.from({ length: 60 }, (_, i) =>
      makeTopic(`t${i}`, { orderIndex: i, estimatedMinutes: 30, subjectId: `s${i % 5}` }),
    )
    const result = generateStudyPlan(makeInput({ topics, dailyMinutes: 60 }))

    expect(result.blocks.length).toBeGreaterThan(0)
    expect(result.warnings).toContain(WARNING_TIGHT)
    expect(result.stats.topicCount).toBeLessThanOrEqual(60)
  })

  it('gunluk sure 0 ise her blok tek basina bir gune duser ve uyari verilir', () => {
    const result = generateStudyPlan(makeInput({ dailyMinutes: 0 }))

    expect(result.stats.weeklyBudgetMinutes).toBe(0)
    expect(result.warnings).toContain(WARNING_OVERSIZED)
    expect(result.warnings).toContain(WARNING_TIGHT)
    for (const [, dayBlocks] of groupByDate(result.blocks)) {
      const topicBlocks = dayBlocks.filter((b) => b.topicId !== null)
      expect(topicBlocks.length).toBeLessThanOrEqual(1)
    }
  })

  it('bos gun kalmadiysa sigmayan blok deneme gunune yerlesir', () => {
    const result = generateStudyPlan(
      makeInput({
        dailyMinutes: 30,
        studyDays: [1, 2],
        topics: [
          makeTopic('t1', { orderIndex: 0, estimatedMinutes: 45 }),
          makeTopic('t2', { orderIndex: 1, estimatedMinutes: 45 }),
        ],
      }),
    )

    const watchDates = result.blocks.filter((b) => b.type === 'watch').map((b) => b.scheduledDate)
    expect(watchDates).toEqual(['2026-03-02', '2026-03-03'])
    expect(result.warnings).toContain(WARNING_OVERSIZED)
    expect(result.warnings).toContain(WARNING_TIGHT)
  })

  it('sifir konu verildiginde bos program doner', () => {
    const result = generateStudyPlan(makeInput({ topics: [] }))

    expect(result.blocks).toEqual([])
    expect(result.stats.topicCount).toBe(0)
    expect(result.stats.totalMinutes).toBe(0)
    expect(result.warnings).toEqual([])
  })
})

describe('generateStudyPlan — tekrar blogu yerlesimi', () => {
  it('tekrar blogu izleme blogundan en az 2 gun sonra gelir', () => {
    const topics = Array.from({ length: 10 }, (_, i) =>
      makeTopic(`t${i}`, { orderIndex: i, estimatedMinutes: 20, subjectId: `s${i % 3}` }),
    )
    const result = generateStudyPlan(makeInput({ topics, dailyMinutes: 150, weeks: 2 }))

    let checked = 0
    for (const topic of topics) {
      const own = blocksOfTopic(result.blocks, topic.id)
      const watch = own.find((b) => b.type === 'watch')
      const review = own.find((b) => b.type === 'review')
      if (!watch || !review) continue
      checked += 1
      expect(
        toDayNumber(review.scheduledDate) - toDayNumber(watch.scheduledDate),
      ).toBeGreaterThanOrEqual(2)
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('uygun gun kalmadiysa tekrar blogu erkene alinmaz, dusurulur', () => {
    // Tek calisma gunu (pazar) var; izlemeden 2 gun sonrasi program disinda.
    const result = generateStudyPlan(makeInput({ studyDays: [7] }))

    expect(result.blocks.some((b) => b.type === 'watch')).toBe(true)
    expect(result.blocks.some((b) => b.type === 'review')).toBe(false)
  })
})

describe('generateStudyPlan — konu siralamasi', () => {
  it('once zayif konular, sonra bilinmeyen, sonra orta seviye gelir', () => {
    const topics = [
      makeTopic('orta', { orderIndex: 1, subjectId: 'mat' }),
      makeTopic('bilinmeyen', { orderIndex: 2, subjectId: 'mat' }),
      makeTopic('zayif', { orderIndex: 3, subjectId: 'mat' }),
    ]
    const result = generateStudyPlan(
      makeInput({
        topics,
        dailyMinutes: 300,
        masteries: [makeMastery('orta', 60, 'medium'), makeMastery('zayif', 20, 'weak')],
      }),
    )

    const watchOrder = result.blocks.filter((b) => b.type === 'watch').map((b) => b.topicId)
    expect(watchOrder).toEqual(['zayif', 'bilinmeyen', 'orta'])
  })

  it('bilinmeyen konular mufredat sirasina gore dizilir', () => {
    const topics = [
      makeTopic('c', { orderIndex: 30 }),
      makeTopic('a', { orderIndex: 10 }),
      makeTopic('b', { orderIndex: 20 }),
    ]
    const result = generateStudyPlan(makeInput({ topics, dailyMinutes: 300 }))

    const watchOrder = result.blocks.filter((b) => b.type === 'watch').map((b) => b.topicId)
    expect(watchOrder).toEqual(['a', 'b', 'c'])
  })

  it('zayif konular oncelik puanina gore azalan sirada dizilir', () => {
    const topics = [
      makeTopic('dusuk', { orderIndex: 1, examWeight: 0.1, difficulty: 1 }),
      makeTopic('yuksek', { orderIndex: 2, examWeight: 0.9, difficulty: 5 }),
    ]
    const result = generateStudyPlan(
      makeInput({
        topics,
        dailyMinutes: 300,
        masteries: [makeMastery('dusuk', 20, 'weak'), makeMastery('yuksek', 20, 'weak')],
      }),
    )

    const watchOrder = result.blocks.filter((b) => b.type === 'watch').map((b) => b.topicId)
    expect(watchOrder).toEqual(['yuksek', 'dusuk'])
  })

  it('guclu konular yalnizca tekrar blogu alir', () => {
    const result = generateStudyPlan(
      makeInput({
        topics: [makeTopic('guclu')],
        masteries: [makeMastery('guclu', 88, 'strong')],
      }),
    )

    const own = blocksOfTopic(result.blocks, 'guclu')
    expect(own.map((b) => b.type)).toEqual(['review'])
  })
})

describe('generateStudyPlan — zaman kisitli mod', () => {
  const constrainedInput = (): PlanInput =>
    makeInput({
      examDate: new Date('2026-03-09T09:00:00+03:00'),
      dailyMinutes: 200,
      topics: [
        makeTopic('zayif', { orderIndex: 0, estimatedMinutes: 100 }),
        ...Array.from({ length: 10 }, (_, i) =>
          makeTopic(`orta${i}`, { orderIndex: i + 1, estimatedMinutes: 100 }),
        ),
        makeTopic('guclu', { orderIndex: 99, estimatedMinutes: 40 }),
      ],
      masteries: [
        makeMastery('zayif', 20, 'weak'),
        ...Array.from({ length: 10 }, (_, i) => makeMastery(`orta${i}`, 60, 'medium')),
        makeMastery('guclu', 90, 'strong'),
      ],
    })

  it('zaman yetmediginde guclu konular programa alinmaz', () => {
    const result = generateStudyPlan(constrainedInput())

    expect(blocksOfTopic(result.blocks, 'guclu')).toEqual([])
    expect(result.warnings).toContain(WARNING_STRONG_DROPPED)
  })

  it('zaman yetmediginde orta seviye konular sadece teste sikistirilir', () => {
    const result = generateStudyPlan(constrainedInput())

    for (let i = 0; i < 10; i += 1) {
      const own = blocksOfTopic(result.blocks, `orta${i}`)
      expect(own.map((b) => b.type)).toEqual(['solve'])
    }
  })

  it('zaman yetmediginde zayif konular tam paketini korur ve yogunluk uyarisi cikar', () => {
    const result = generateStudyPlan(constrainedInput())

    expect(blocksOfTopic(result.blocks, 'zayif').map((b) => b.type)).toEqual([
      'watch',
      'solve',
      'review',
    ])
    expect(result.warnings).toContain(WARNING_TIGHT)
  })

  it('zaman bolluysa guclu konular dusurulmez ve uyari verilmez', () => {
    const result = generateStudyPlan(
      makeInput({
        topics: [makeTopic('guclu')],
        masteries: [makeMastery('guclu', 88, 'strong')],
      }),
    )

    expect(result.warnings).not.toContain(WARNING_STRONG_DROPPED)
    expect(blocksOfTopic(result.blocks, 'guclu').length).toBeGreaterThan(0)
  })
})

describe('generateStudyPlan — sablonlar', () => {
  const templateTopics = Array.from({ length: 4 }, (_, i) =>
    makeTopic(`t${i}`, { orderIndex: i, estimatedMinutes: 20, subjectId: `s${i % 2}` }),
  )

  it('balanced sablonu izle, coz, tekrar ve deneme bloklarini uretir', () => {
    const result = generateStudyPlan(
      makeInput({ topics: templateTopics, template: 'balanced', dailyMinutes: 150 }),
    )
    const types = new Set(result.blocks.map((b) => b.type))

    expect(types).toEqual(new Set(['watch', 'solve', 'review', 'mock']))
  })

  it('video_only sablonu sadece izleme ve deneme blogu uretir', () => {
    const result = generateStudyPlan(
      makeInput({ topics: templateTopics, template: 'video_only', dailyMinutes: 150 }),
    )
    const types = new Set(result.blocks.map((b) => b.type))

    expect(types).toEqual(new Set(['watch', 'mock']))
  })

  it('test_only sablonu sadece coz ve deneme blogu uretir', () => {
    const result = generateStudyPlan(
      makeInput({ topics: templateTopics, template: 'test_only', dailyMinutes: 150 }),
    )
    const types = new Set(result.blocks.map((b) => b.type))

    expect(types).toEqual(new Set(['solve', 'mock']))
  })

  it('last_30_days sablonu izleme blogu uretmez, coz + tekrar uretir', () => {
    const result = generateStudyPlan(
      makeInput({ topics: templateTopics, template: 'last_30_days', dailyMinutes: 150 }),
    )
    const types = new Set(result.blocks.map((b) => b.type))

    expect(types).toEqual(new Set(['solve', 'review', 'mock']))
    expect(result.blocks.some((b) => b.type === 'watch')).toBe(false)
  })

  it('last_30_days tum statuleri oncelige gore tek listede siralar', () => {
    const topics = [
      makeTopic('guclu', { orderIndex: 0, examWeight: 1, difficulty: 5 }),
      makeTopic('orta', { orderIndex: 1, examWeight: 0.3, difficulty: 2 }),
      makeTopic('zayif', { orderIndex: 2, examWeight: 0.2, difficulty: 1 }),
    ]
    const result = generateStudyPlan(
      makeInput({
        topics,
        template: 'last_30_days',
        masteries: [
          makeMastery('guclu', 80, 'strong'),
          makeMastery('orta', 60, 'medium'),
          makeMastery('zayif', 40, 'weak'),
        ],
      }),
    )

    const solveOrder = result.blocks.filter((b) => b.type === 'solve').map((b) => b.topicId)
    expect(solveOrder).toEqual(['guclu', 'orta', 'zayif'])
  })
})

describe('generateStudyPlan — hafta sayisi ve deneme bloklari', () => {
  const manyTopics = Array.from({ length: 40 }, (_, i) =>
    makeTopic(`t${i}`, { orderIndex: i, estimatedMinutes: 20, subjectId: `s${i % 3}` }),
  )

  it('weeks = 4 verildiginde 4 haftalik deneme blogu uretilir', () => {
    const result = generateStudyPlan(makeInput({ topics: manyTopics, weeks: 4, dailyMinutes: 60 }))
    const mocks = result.blocks.filter((b) => b.type === 'mock')

    expect(mocks).toHaveLength(4)
    expect(mocks.map((b) => b.scheduledDate)).toEqual([
      '2026-03-06',
      '2026-03-13',
      '2026-03-20',
      '2026-03-27',
    ])
  })

  it('weeks verilmezse tek hafta uretilir', () => {
    const result = generateStudyPlan(makeInput({ topics: manyTopics, dailyMinutes: 60 }))

    expect(result.blocks.filter((b) => b.type === 'mock')).toHaveLength(1)
    for (const block of result.blocks) {
      expect(block.scheduledDate <= '2026-03-08').toBe(true)
    }
  })

  it('weeks 0 verilirse en az bir hafta uretilir', () => {
    const result = generateStudyPlan(makeInput({ topics: manyTopics, weeks: 0, dailyMinutes: 60 }))

    expect(result.blocks.length).toBeGreaterThan(0)
    expect(result.blocks.filter((b) => b.type === 'mock')).toHaveLength(1)
  })

  it('konular erken bitse bile her uretilen hafta deneme blogu alir', () => {
    // 2 konu ilk gune sigar; yine de 4 haftanin dordu de deneme almalidir.
    const result = generateStudyPlan(
      makeInput({
        weeks: 4,
        dailyMinutes: 120,
        topics: [makeTopic('a', { orderIndex: 0 }), makeTopic('b', { orderIndex: 1 })],
      }),
    )
    const mocks = result.blocks.filter((b) => b.type === 'mock')

    expect(mocks).toHaveLength(4)
    expect(mocks.map((b) => b.scheduledDate)).toEqual([
      '2026-03-06',
      '2026-03-13',
      '2026-03-20',
      '2026-03-27',
    ])
  })

  it('programa hic konu girmediyse deneme blogu uretilmez', () => {
    const result = generateStudyPlan(makeInput({ topics: [], weeks: 3 }))

    expect(result.blocks.filter((b) => b.type === 'mock')).toHaveLength(0)
  })
})

describe('generateStudyPlan — belirlilik', () => {
  it('ayni girdi ile iki cagri derinlemesine esit sonuc verir', () => {
    const input = makeInput({
      topics: Array.from({ length: 15 }, (_, i) =>
        makeTopic(`t${i}`, {
          orderIndex: i,
          estimatedMinutes: 20 + (i % 4) * 10,
          subjectId: `s${i % 4}`,
        }),
      ),
      masteries: [
        makeMastery('t0', 20, 'weak'),
        makeMastery('t1', 60, 'medium'),
        makeMastery('t2', 90, 'strong'),
        makeMastery('t3', 10, 'unknown'),
      ],
      weeks: 3,
      dailyMinutes: 140,
    })

    const first = generateStudyPlan(input)
    const second = generateStudyPlan(input)

    expect(second).toEqual(first)
  })

  it('esit oncelikli konularda sira mufredat sirasina gore sabittir', () => {
    const topics = [makeTopic('b', { orderIndex: 5 }), makeTopic('a', { orderIndex: 1 })]
    const result = generateStudyPlan(
      makeInput({
        topics,
        dailyMinutes: 300,
        masteries: [makeMastery('a', 20, 'weak'), makeMastery('b', 20, 'weak')],
      }),
    )

    const watchOrder = result.blocks.filter((b) => b.type === 'watch').map((b) => b.topicId)
    expect(watchOrder).toEqual(['a', 'b'])
  })

  it('oncelik ve mufredat sirasi da esitse sira konu kimligine gore sabittir', () => {
    const topics = [makeTopic('b', { orderIndex: 4 }), makeTopic('a', { orderIndex: 4 })]
    const result = generateStudyPlan(
      makeInput({
        topics,
        dailyMinutes: 300,
        masteries: [makeMastery('a', 20, 'weak'), makeMastery('b', 20, 'weak')],
      }),
    )

    const watchOrder = result.blocks.filter((b) => b.type === 'watch').map((b) => b.topicId)
    expect(watchOrder).toEqual(['a', 'b'])
  })
})
