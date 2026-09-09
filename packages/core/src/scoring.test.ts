import { describe, it, expect } from 'vitest'

import {
  MIN_PERCENTILE_SAMPLE,
  calculateMockSummary,
  calculateNet,
  calculatePercentile,
} from './scoring'
import type { MockAttemptInput, MockSectionInput } from './types'

// Bu modul tarih kullanmaz; yine de sabit referans, ileride bir alan eklenirse
// testlerin gorece tarihe kaymasini engeller.
const FIXED_NOW = new Date('2026-03-02T09:00:00+03:00')

function section(subjectId: string, subjectName: string, questionIds: string[]): MockSectionInput {
  return { subjectId, subjectName, questionIds }
}

function makeSection(subjectId: string, count: number, prefix = subjectId): MockSectionInput {
  const questionIds = Array.from({ length: count }, (_, index) => `${prefix}-q${index + 1}`)
  return section(subjectId, subjectId.toUpperCase(), questionIds)
}

function answer(questionId: string, isCorrect: boolean, topicId = 'topic-a'): MockAttemptInput {
  return { questionId, selectedOption: isCorrect ? 'A' : 'B', isCorrect, topicId }
}

function blankAnswer(questionId: string, topicId = 'topic-a'): MockAttemptInput {
  return { questionId, selectedOption: null, isCorrect: false, topicId }
}

function repeat(count: number, value: number): number[] {
  return Array.from({ length: count }, () => value)
}

function ascendingNets(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1)
}

describe('calculateNet', () => {
  it('LGS 3 yanlis kurali ile TYT 4 yanlis kurali ayni ham sayilarda FARKLI net verir', () => {
    const correct = 20
    const wrong = 6

    const tyt = calculateNet(correct, wrong, 4)
    const lgs = calculateNet(correct, wrong, 3)

    expect(tyt).toBe(18.5)
    expect(lgs).toBe(18)
    expect(tyt).not.toBe(lgs)
  })

  it('yuvarlama: 10 dogru 3 yanlis /4 -> 9.25', () => {
    expect(calculateNet(10, 3, 4)).toBe(9.25)
  })

  it('yuvarlama: 10 dogru 1 yanlis /3 -> 9.67', () => {
    expect(calculateNet(10, 1, 3)).toBe(9.67)
  })

  it('tamami dogru: net dogru sayisina esittir', () => {
    expect(calculateNet(40, 0, 4)).toBe(40)
    expect(calculateNet(20, 0, 3)).toBe(20)
  })

  it('tamami bos: net 0', () => {
    expect(calculateNet(0, 0, 4)).toBe(0)
    expect(calculateNet(0, 0, 3)).toBe(0)
  })

  it('tamami yanlis: net negatiftir ve sifira KIRPILMAZ', () => {
    expect(calculateNet(0, 40, 4)).toBe(-10)
    expect(calculateNet(0, 20, 3)).toBe(-6.67)
    expect(calculateNet(0, 10, 3)).toBeLessThan(0)
  })

  it('-0 asla dondurulmez', () => {
    const cases: number[] = [
      calculateNet(0, 0, 4),
      calculateNet(0, 0, 3),
      calculateNet(1, 4, 4),
      calculateNet(1, 3, 3),
      calculateNet(0, 0.0001, 4),
    ]
    for (const net of cases) {
      expect(Object.is(net, -0)).toBe(false)
      expect(net).toBe(0)
    }
  })

  it('negatif net 2 basamaga simetrik yuvarlanir', () => {
    expect(calculateNet(3, 10, 3)).toBe(-0.33)
    expect(calculateNet(1, 7, 3)).toBe(-1.33)
  })

  it('gecersiz veya negatif adetler savunmaci olarak 0 sayilir', () => {
    expect(calculateNet(-5, 0, 4)).toBe(0)
    expect(calculateNet(10, -4, 4)).toBe(10)
    expect(calculateNet(Number.NaN, 4, 4)).toBe(-1)
    expect(calculateNet(10, Number.POSITIVE_INFINITY, 4)).toBe(10)
  })
})

describe('calculateMockSummary', () => {
  it('bolum ve genel toplamlari dogru/yanlis/bos olarak ayirir', () => {
    const sections = [makeSection('mat', 4), makeSection('tur', 3)]
    const attempts: MockAttemptInput[] = [
      answer('mat-q1', true, 'topic-mat-1'),
      answer('mat-q2', false, 'topic-mat-1'),
      blankAnswer('mat-q3', 'topic-mat-2'),
      // mat-q4 hic cevaplanmadi -> bos
      answer('tur-q1', true, 'topic-tur-1'),
      answer('tur-q2', true, 'topic-tur-1'),
      answer('tur-q3', false, 'topic-tur-2'),
    ]

    const summary = calculateMockSummary(sections, attempts, { divisor: 4 })

    expect(summary.sections).toHaveLength(2)
    expect(summary.sections[0]).toMatchObject({
      subjectId: 'mat',
      subjectName: 'MAT',
      total: 4,
      correct: 1,
      wrong: 1,
      blank: 2,
      net: 0.75,
    })
    expect(summary.sections[1]).toMatchObject({
      subjectId: 'tur',
      total: 3,
      correct: 2,
      wrong: 1,
      blank: 0,
      net: 1.75,
    })
    expect(summary.total).toBe(7)
    expect(summary.correct).toBe(3)
    expect(summary.wrong).toBe(2)
    expect(summary.blank).toBe(2)
    expect(summary.net).toBe(2.5)
  })

  it('cevabi olmayan soru da, sikki bosaltilmis soru da BOS sayilir', () => {
    const sections = [makeSection('mat', 2)]
    const attempts = [blankAnswer('mat-q1')]

    const summary = calculateMockSummary(sections, attempts, { divisor: 4 })

    expect(summary.blank).toBe(2)
    expect(summary.correct).toBe(0)
    expect(summary.wrong).toBe(0)
  })

  it('tamami bos deneme: net 0 ve -0 uretmez', () => {
    const sections = [makeSection('mat', 40)]

    const summary = calculateMockSummary(sections, [], { divisor: 4 })

    expect(summary.total).toBe(40)
    expect(summary.blank).toBe(40)
    expect(summary.net).toBe(0)
    expect(Object.is(summary.net, -0)).toBe(false)
    expect(Object.is(summary.sections[0]?.net, -0)).toBe(false)
    expect(summary.byTopic).toEqual([])
  })

  it('tamami dogru deneme: net soru sayisina esittir', () => {
    const sections = [makeSection('mat', 10)]
    const attempts = sections[0]?.questionIds.map((id) => answer(id, true)) ?? []

    const summary = calculateMockSummary(sections, attempts, { divisor: 4 })

    expect(summary.correct).toBe(10)
    expect(summary.wrong).toBe(0)
    expect(summary.blank).toBe(0)
    expect(summary.net).toBe(10)
  })

  it('tamami yanlis deneme: net negatife duser', () => {
    const sections = [makeSection('mat', 12)]
    const attempts = sections[0]?.questionIds.map((id) => answer(id, false)) ?? []

    const summary = calculateMockSummary(sections, attempts, { divisor: 4 })

    expect(summary.wrong).toBe(12)
    expect(summary.net).toBe(-3)
    expect(summary.net).toBeLessThan(0)
  })

  it('LGS (/3) ve TYT (/4) ayni cevap setinde farkli net uretir', () => {
    const sections = [makeSection('mat', 10)]
    const attempts: MockAttemptInput[] = [
      ...['mat-q1', 'mat-q2', 'mat-q3', 'mat-q4'].map((id) => answer(id, true)),
      ...['mat-q5', 'mat-q6', 'mat-q7'].map((id) => answer(id, false)),
    ]

    const tyt = calculateMockSummary(sections, attempts, { divisor: 4 })
    const lgs = calculateMockSummary(sections, attempts, { divisor: 3 })

    expect(tyt.net).toBe(3.25)
    expect(lgs.net).toBe(3)
    expect(tyt.net).not.toBe(lgs.net)
    expect(tyt.correct).toBe(lgs.correct)
    expect(tyt.wrong).toBe(lgs.wrong)
  })

  it('genel net, bolum netlerinin toplamidir (bolum bazinda yuvarlanir)', () => {
    const sections = [makeSection('a', 11), makeSection('b', 11)]
    const attempts: MockAttemptInput[] = []
    for (const prefix of ['a', 'b']) {
      for (let i = 1; i <= 10; i += 1) attempts.push(answer(`${prefix}-q${i}`, true))
      attempts.push(answer(`${prefix}-q11`, false))
    }

    const summary = calculateMockSummary(sections, attempts, { divisor: 3 })

    expect(summary.sections[0]?.net).toBe(9.67)
    expect(summary.sections[1]?.net).toBe(9.67)
    // Tek seferde hesaplansaydi 20 - 2/3 = 19.33 cikardi; sartname bolum
    // netlerinin toplamini istiyor.
    expect(summary.net).toBe(19.34)
  })

  it('hicbir bolumde yer almayan bir cevap yok sayilir', () => {
    const sections = [makeSection('mat', 2)]
    const attempts: MockAttemptInput[] = [
      answer('mat-q1', true, 'topic-mat'),
      answer('mat-q2', false, 'topic-mat'),
      answer('silinmis-soru', true, 'topic-hayalet'),
    ]

    const summary = calculateMockSummary(sections, attempts, { divisor: 4 })

    expect(summary.total).toBe(2)
    expect(summary.correct).toBe(1)
    expect(summary.wrong).toBe(1)
    expect(summary.blank).toBe(0)
    expect(summary.net).toBe(0.75)
    expect(summary.byTopic).toEqual([{ topicId: 'topic-mat', total: 2, correct: 1 }])
  })

  it('iki bolumde birden gecen soru her iki bolumde de sayilir ve cokmez', () => {
    const sections = [
      section('mat', 'Matematik', ['ortak-q', 'mat-q1']),
      section('geo', 'Geometri', ['ortak-q', 'geo-q1']),
    ]
    const attempts: MockAttemptInput[] = [
      answer('ortak-q', true, 'topic-ortak'),
      answer('mat-q1', false, 'topic-mat'),
      blankAnswer('geo-q1', 'topic-geo'),
    ]

    const summary = calculateMockSummary(sections, attempts, { divisor: 4 })

    expect(summary.sections[0]).toMatchObject({ correct: 1, wrong: 1, blank: 0, net: 0.75 })
    expect(summary.sections[1]).toMatchObject({ correct: 1, wrong: 0, blank: 1, net: 1 })
    expect(summary.total).toBe(4)
    expect(summary.correct).toBe(2)
    expect(summary.net).toBe(1.75)
    // Konu kirilimi cevap basinadir: ortak soru iki kez sayilmaz.
    expect(summary.byTopic).toEqual([
      { topicId: 'topic-mat', total: 1, correct: 0 },
      { topicId: 'topic-ortak', total: 1, correct: 1 },
    ])
  })

  it('byTopic bos olmayan cevaplari toplar ve topicId sirasina gore siralar', () => {
    const sections = [makeSection('mat', 5)]
    const attempts: MockAttemptInput[] = [
      answer('mat-q1', true, 'topic-z'),
      answer('mat-q2', false, 'topic-a'),
      answer('mat-q3', true, 'topic-a'),
      answer('mat-q4', true, 'topic-m'),
      blankAnswer('mat-q5', 'topic-a'),
    ]

    const summary = calculateMockSummary(sections, attempts, { divisor: 4 })

    expect(summary.byTopic).toEqual([
      { topicId: 'topic-a', total: 2, correct: 1 },
      { topicId: 'topic-m', total: 1, correct: 1 },
      { topicId: 'topic-z', total: 1, correct: 1 },
    ])
  })

  it('ayni soru icin birden fazla kayit gelirse sonuncusu gecerlidir', () => {
    const sections = [makeSection('mat', 1)]
    const attempts: MockAttemptInput[] = [
      answer('mat-q1', false, 'topic-a'),
      answer('mat-q1', true, 'topic-a'),
    ]

    const summary = calculateMockSummary(sections, attempts, { divisor: 4 })

    expect(summary.correct).toBe(1)
    expect(summary.wrong).toBe(0)
    expect(summary.byTopic).toEqual([{ topicId: 'topic-a', total: 1, correct: 1 }])
  })

  it('bos bolum listesi cokmeden sifir ozet doner', () => {
    const summary = calculateMockSummary([], [answer('hayalet', true)], { divisor: 4 })

    expect(summary.sections).toEqual([])
    expect(summary.total).toBe(0)
    expect(summary.correct).toBe(0)
    expect(summary.wrong).toBe(0)
    expect(summary.blank).toBe(0)
    expect(summary.net).toBe(0)
    expect(summary.byTopic).toEqual([])
  })

  it('sorusu olmayan bolum toplamlari bozmaz', () => {
    const sections = [makeSection('mat', 2), section('bos', 'Bos Ders', [])]

    const summary = calculateMockSummary(sections, [answer('mat-q1', true)], { divisor: 4 })

    expect(summary.sections[1]).toMatchObject({ total: 0, correct: 0, wrong: 0, blank: 0, net: 0 })
    expect(summary.total).toBe(2)
  })

  it('durationSeconds gecirilmezse veya null ise null doner, verilirse aynen gecer', () => {
    const sections = [makeSection('mat', 1)]

    expect(calculateMockSummary(sections, [], { divisor: 4 }).durationSeconds).toBeNull()
    expect(
      calculateMockSummary(sections, [], { divisor: 4, durationSeconds: null }).durationSeconds,
    ).toBeNull()
    expect(
      calculateMockSummary(sections, [], { divisor: 4, durationSeconds: 9000 }).durationSeconds,
    ).toBe(9000)
    expect(
      calculateMockSummary(sections, [], { divisor: 4, durationSeconds: 0 }).durationSeconds,
    ).toBe(0)
  })

  it('ayni girdiyle iki cagri birebir ayni sonucu verir (deterministik)', () => {
    const sections = [makeSection('mat', 3), makeSection('tur', 2)]
    const attempts: MockAttemptInput[] = [
      answer('mat-q1', true, 'topic-b'),
      answer('mat-q2', false, 'topic-a'),
      answer('tur-q1', true, 'topic-c'),
    ]
    const config = { divisor: 4, durationSeconds: FIXED_NOW.getUTCHours() * 3600 } as const

    expect(calculateMockSummary(sections, attempts, config)).toEqual(
      calculateMockSummary(sections, attempts, config),
    )
  })
})

describe('calculatePercentile', () => {
  it('MIN_PERCENTILE_SAMPLE 20 olarak disa acilir', () => {
    expect(MIN_PERCENTILE_SAMPLE).toBe(20)
  })

  it('tam 19 katilimci -> null (yeterli veri yok)', () => {
    const nets = ascendingNets(19)

    expect(nets).toHaveLength(19)
    expect(calculatePercentile(10, nets)).toBeNull()
  })

  it('tam 20 katilimci -> sayi doner', () => {
    const nets = ascendingNets(20)

    const result = calculatePercentile(10, nets)

    expect(result).not.toBeNull()
    expect(typeof result).toBe('number')
    expect(result).toBe(47.5)
  })

  it('bos liste ve tek katilimci null doner', () => {
    expect(calculatePercentile(50, [])).toBeNull()
    expect(calculatePercentile(50, [50])).toBeNull()
  })

  it('tum netler ayni ise 50 doner', () => {
    expect(calculatePercentile(42.5, repeat(20, 42.5))).toBe(50)
    expect(calculatePercentile(0, repeat(60, 0))).toBe(50)
  })

  it('en yuksek net alan ogrenci: esitin yarisi kadar altta kalir', () => {
    const nets = ascendingNets(20)

    expect(calculatePercentile(20, nets)).toBe(97.5)
  })

  it('en dusuk net alan ogrenci: 100 degil, orta-siralama degeri', () => {
    const nets = ascendingNets(20)

    expect(calculatePercentile(1, nets)).toBe(2.5)
  })

  it('siralanmamis girdi ile siralanmis girdi ayni sonucu verir', () => {
    const sorted = ascendingNets(25)
    const shuffled = [...sorted].reverse()

    expect(calculatePercentile(13, shuffled)).toBe(calculatePercentile(13, sorted))
  })

  it('esit netler yarim agirlikla sayilir', () => {
    // 10 kisi 20 net, 10 kisi 40 net. 40 net alan: (10 + 5) / 20 = %75.
    const nets = [...repeat(10, 20), ...repeat(10, 40)]

    expect(calculatePercentile(40, nets)).toBe(75)
    expect(calculatePercentile(20, nets)).toBe(25)
  })

  it('sonuc 1 basamaga yuvarlanir', () => {
    const nets = ascendingNets(21)

    // (20 + 0.5) / 21 * 100 = 97.619...
    expect(calculatePercentile(21, nets)).toBe(97.6)
  })

  it('sonuc 0-100 araligina kirpilir ve -0 uretmez', () => {
    const nets = ascendingNets(20)

    const top = calculatePercentile(999, nets)
    const bottom = calculatePercentile(-999, nets)

    expect(top).toBe(100)
    expect(bottom).toBe(0)
    expect(Object.is(bottom, -0)).toBe(false)
  })

  it('negatif netler dogru siralanir', () => {
    const nets = [...repeat(19, 5), -3]

    expect(calculatePercentile(-3, nets)).toBe(2.5)
    expect(calculatePercentile(5, nets)).toBe(52.5)
  })

  it('gecersiz kayitlar ayiklanir; ayiklama sonrasi ornek yetersizse null doner', () => {
    const nets = [...ascendingNets(19), Number.NaN]

    expect(calculatePercentile(10, nets)).toBeNull()
    expect(calculatePercentile(Number.NaN, ascendingNets(20))).toBeNull()
    expect(calculatePercentile(10, [...ascendingNets(20), Number.POSITIVE_INFINITY])).toBe(47.5)
  })
})
