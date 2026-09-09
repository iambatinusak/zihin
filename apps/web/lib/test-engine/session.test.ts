import { describe, expect, it } from 'vitest'
import {
  buildQuestionOrder,
  canRevealAnswers,
  isSessionResumable,
  nextUnanswered,
  summarise,
  type SummaryAttempt,
  type SummaryQuestion,
} from './session'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `q${i + 1}`)

describe('buildQuestionOrder', () => {
  it('aynı tohumla her zaman aynı sırayı üretir', () => {
    const input = ids(20)
    const first = buildQuestionOrder(input, 'seed-a')
    const second = buildQuestionOrder(input, 'seed-a')
    expect(second).toEqual(first)
    // Üçüncü kez de aynı olmalı — üreteç durumu çağrılar arasında sızmıyor.
    expect(buildQuestionOrder(input, 'seed-a')).toEqual(first)
  })

  it('farklı tohum farklı sıra üretir', () => {
    const input = ids(20)
    expect(buildQuestionOrder(input, 'seed-a')).not.toEqual(buildQuestionOrder(input, 'seed-b'))
  })

  it('girdiyi değiştirmez ve tüm kimlikleri korur', () => {
    const input = ids(10)
    const copy = [...input]
    const output = buildQuestionOrder(input, 'x')
    expect(input).toEqual(copy)
    expect([...output].sort()).toEqual([...input].sort())
    expect(output).toHaveLength(10)
  })

  it('gerçekten karıştırır (özdeşlik sırası değil)', () => {
    const input = ids(30)
    expect(buildQuestionOrder(input, 'karistir')).not.toEqual(input)
  })

  it('boş ve tek elemanlı listeyi olduğu gibi döner', () => {
    expect(buildQuestionOrder([], 'seed')).toEqual([])
    expect(buildQuestionOrder(['tek'], 'seed')).toEqual(['tek'])
  })

  it('boş tohumda bile çökmez ve deterministiktir', () => {
    const input = ids(5)
    expect(buildQuestionOrder(input, '')).toEqual(buildQuestionOrder(input, ''))
  })
})

describe('summarise', () => {
  const questions: SummaryQuestion[] = [
    { questionId: 'q1', topicId: 't1' },
    { questionId: 'q2', topicId: 't1' },
    { questionId: 'q3', topicId: 't1' },
    { questionId: 'q4', topicId: 't2' },
    { questionId: 'q5', topicId: 't2' },
  ]

  const attempt = (
    questionId: string,
    selectedOption: string | null,
    isCorrect: boolean,
    timeSpentMs = 1000,
  ): SummaryAttempt => ({ questionId, selectedOption, isCorrect, timeSpentMs })

  it('TYT (÷4): 3 doğru 2 yanlış = 2.5 net', () => {
    const summary = summarise(
      questions,
      [
        attempt('q1', 'A', true),
        attempt('q2', 'B', true),
        attempt('q3', 'C', true),
        attempt('q4', 'D', false),
        attempt('q5', 'E', false),
      ],
      4,
    )
    expect(summary.correct).toBe(3)
    expect(summary.wrong).toBe(2)
    expect(summary.blank).toBe(0)
    expect(summary.total).toBe(5)
    expect(summary.net).toBe(2.5)
    expect(summary.totalTimeMs).toBe(5000)
  })

  it('LGS (÷3): aynı cevaplarla 3 - 2/3 = 2.33 net', () => {
    const summary = summarise(
      questions,
      [
        attempt('q1', 'A', true),
        attempt('q2', 'B', true),
        attempt('q3', 'C', true),
        attempt('q4', 'D', false),
        attempt('q5', 'E', false),
      ],
      3,
    )
    expect(summary.net).toBe(2.33)
  })

  it('hepsi boş: 0 net, sıfır süre, tüm sorular boş sayılır', () => {
    const summary = summarise(questions, [], 4)
    expect(summary).toMatchObject({
      total: 5,
      correct: 0,
      wrong: 0,
      blank: 5,
      net: 0,
      totalTimeMs: 0,
    })
    expect(summary.byTopic).toEqual([
      { topicId: 't1', total: 3, correct: 0, wrong: 0, blank: 3, net: 0 },
      { topicId: 't2', total: 2, correct: 0, wrong: 0, blank: 2, net: 0 },
    ])
  })

  it('şıkkı boşaltılmış cevap boş sayılır, yanlış sayılmaz', () => {
    const summary = summarise(questions, [attempt('q1', null, false, 400)], 4)
    expect(summary.blank).toBe(5)
    expect(summary.wrong).toBe(0)
    // Boş bırakılan soruda geçirilen süre yine de sayılır.
    expect(summary.totalTimeMs).toBe(400)
  })

  it('net negatif olabilir, sıfıra kırpılmaz', () => {
    const summary = summarise(
      questions,
      [
        attempt('q1', 'A', false),
        attempt('q2', 'A', false),
        attempt('q3', 'A', false),
        attempt('q4', 'A', false),
      ],
      4,
    )
    expect(summary.net).toBe(-1)
  })

  it('aynı soru için son kayıt geçerlidir', () => {
    const summary = summarise(questions, [attempt('q1', 'A', false), attempt('q1', 'B', true)], 4)
    expect(summary.correct).toBe(1)
    expect(summary.wrong).toBe(0)
  })

  it('testte olmayan cevap yok sayılır', () => {
    const summary = summarise(questions, [attempt('yabanci', 'A', true, 9999)], 4)
    expect(summary.correct).toBe(0)
    expect(summary.totalTimeMs).toBe(0)
  })

  it('konu kırılımını konu kimliğine göre sıralı döner', () => {
    const summary = summarise(
      [
        { questionId: 'q1', topicId: 'zeta' },
        { questionId: 'q2', topicId: 'alfa' },
      ],
      [attempt('q1', 'A', true), attempt('q2', 'B', false)],
      4,
    )
    expect(summary.byTopic.map((row) => row.topicId)).toEqual(['alfa', 'zeta'])
    expect(summary.byTopic[0]).toEqual({
      topicId: 'alfa',
      total: 1,
      correct: 0,
      wrong: 1,
      blank: 0,
      net: -0.25,
    })
  })

  it('geçersiz veya negatif süre toplamı bozmaz', () => {
    const summary = summarise(
      questions,
      [
        attempt('q1', 'A', true, -5),
        attempt('q2', 'A', true, Number.NaN),
        attempt('q3', 'A', true, 250),
      ],
      4,
    )
    expect(summary.totalTimeMs).toBe(250)
  })

  it('soru listesi boşsa her şey sıfırdır', () => {
    expect(summarise([], [attempt('q1', 'A', true)], 4)).toEqual({
      total: 0,
      correct: 0,
      wrong: 0,
      blank: 0,
      net: 0,
      totalTimeMs: 0,
      byTopic: [],
    })
  })
})

describe('isSessionResumable', () => {
  const now = new Date('2026-01-10T12:00:00.000Z')

  it('bitmiş oturum sürdürülemez', () => {
    expect(
      isSessionResumable(
        { finished_at: '2026-01-10T11:00:00.000Z', expires_at: '2026-01-11T00:00:00.000Z' },
        now,
      ),
    ).toBe(false)
  })

  it('süresi dolmamış yarım oturum sürdürülebilir', () => {
    expect(
      isSessionResumable({ finished_at: null, expires_at: '2026-01-10T12:00:00.001Z' }, now),
    ).toBe(true)
  })

  it('24 saatlik sınırın tam üstünde sürdürülemez', () => {
    // Oturum 2026-01-09T12:00'de başlamış; 24 saatlik pencere tam şimdi doluyor.
    expect(
      isSessionResumable({ finished_at: null, expires_at: '2026-01-10T12:00:00.000Z' }, now),
    ).toBe(false)
  })

  it('sınırın bir milisaniye altında sürdürülemez', () => {
    expect(
      isSessionResumable({ finished_at: null, expires_at: '2026-01-10T11:59:59.999Z' }, now),
    ).toBe(false)
  })

  it('okunamayan zaman damgasında sürdürülemez sayılır', () => {
    expect(isSessionResumable({ finished_at: null, expires_at: 'bozuk' }, now)).toBe(false)
  })
})

describe('nextUnanswered', () => {
  const order = ['q1', 'q2', 'q3', 'q4', 'q5']

  it('baştan ilk boş soruyu bulur', () => {
    expect(nextUnanswered(order, ['q1', 'q2'])).toBe(2)
  })

  it('mevcut sorudan sonrakini bulur, kendisini atlar', () => {
    expect(nextUnanswered(order, [], 1)).toBe(2)
  })

  it('listenin sonundan başa sarar', () => {
    // q5'teyiz; ileride boş yok, başa sarıp q2'yi bulmalı.
    expect(nextUnanswered(order, ['q1', 'q3', 'q4', 'q5'], 4)).toBe(1)
  })

  it('sondaki sorudan sonra ilk boş soruya sarar', () => {
    expect(nextUnanswered(order, [], 4)).toBe(0)
  })

  it('hepsi cevaplıysa null döner', () => {
    expect(nextUnanswered(order, order, 2)).toBeNull()
  })

  it('yalnızca mevcut soru boşsa tam turdan sonra kendini döner', () => {
    expect(nextUnanswered(order, ['q1', 'q2', 'q4', 'q5'], 2)).toBe(2)
  })

  it('boş listede null döner', () => {
    expect(nextUnanswered([], [])).toBeNull()
  })

  it('Set girdisini de kabul eder', () => {
    expect(nextUnanswered(order, new Set(['q1']))).toBe(1)
  })
})

/*
 * Ürünün en önemli değişmezi: cevap anahtarı yalnızca BİTMİŞ oturumda açılır.
 * `getResult` bu yüklemi kullanır; burada kırılan bir test, cevabın test
 * sürerken tarayıcıya sızabildiği anlamına gelir.
 */
describe('canRevealAnswers', () => {
  it('bitmemiş oturumda cevap anahtarını açmaz', () => {
    expect(canRevealAnswers({ finished_at: null })).toBe(false)
  })

  it('bitmiş oturumda açar', () => {
    expect(canRevealAnswers({ finished_at: '2026-01-10T12:00:00.000Z' })).toBe(true)
  })

  it('boş ya da yalnızca boşluktan oluşan damgayı bitmiş saymaz', () => {
    expect(canRevealAnswers({ finished_at: '' })).toBe(false)
    expect(canRevealAnswers({ finished_at: '   ' })).toBe(false)
  })

  it('string olmayan bir damgayı (bozuk kayıt) bitmiş saymaz', () => {
    expect(canRevealAnswers({ finished_at: undefined as unknown as string | null })).toBe(false)
    expect(canRevealAnswers({ finished_at: 0 as unknown as string | null })).toBe(false)
  })

  it('sürdürülebilir bir oturum asla açılmaz — iki yüklem birbirini dışlar', () => {
    const session = { finished_at: null, expires_at: '2999-01-01T00:00:00.000Z' }
    expect(isSessionResumable(session, new Date('2026-01-10T12:00:00.000Z'))).toBe(true)
    expect(canRevealAnswers(session)).toBe(false)
  })
})
