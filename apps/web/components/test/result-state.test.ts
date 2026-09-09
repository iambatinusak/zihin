import { describe, expect, it } from 'vitest'
import {
  averageMs,
  filterReview,
  formatDurationMs,
  groupBySubject,
  successPercent,
  type TopicLabel,
} from './result-state'

const UNITS = { hour: 'sa', minute: 'dk', second: 'sn' }

describe('formatDurationMs', () => {
  it('bir dakikanın altında saniye gösterir', () => {
    expect(formatDurationMs(45_000, UNITS)).toBe('45 sn')
  })

  it('dakika aralığında saniyeyi yutar', () => {
    expect(formatDurationMs(125_000, UNITS)).toBe('2 dk')
  })

  it('bir saatin üstünde saat ve dakika gösterir', () => {
    expect(formatDurationMs(4_320_000, UNITS)).toBe('1 sa 12 dk')
  })

  it('sıfır ve geçersiz değerleri 0 saniye sayar', () => {
    expect(formatDurationMs(0, UNITS)).toBe('0 sn')
    expect(formatDurationMs(-1, UNITS)).toBe('0 sn')
    expect(formatDurationMs(Number.NaN, UNITS)).toBe('0 sn')
  })
})

describe('averageMs', () => {
  it('toplamı soru sayısına böler', () => {
    expect(averageMs(60_000, 4)).toBe(15_000)
  })

  it('soru yoksa sıfırdır (bölme hatası vermez)', () => {
    expect(averageMs(60_000, 0)).toBe(0)
  })
})

describe('successPercent', () => {
  it('yüzdeyi yuvarlar', () => {
    expect(successPercent(1, 3)).toBe(33)
    expect(successPercent(2, 3)).toBe(67)
  })

  it('sınır durumları', () => {
    expect(successPercent(0, 10)).toBe(0)
    expect(successPercent(10, 10)).toBe(100)
    expect(successPercent(3, 0)).toBe(0)
  })
})

describe('groupBySubject', () => {
  const labels = new Map<string, TopicLabel>([
    ['t1', { topicId: 't1', topicTitle: 'Türev', subjectId: 's1', subjectName: 'Matematik' }],
    ['t2', { topicId: 't2', topicTitle: 'İntegral', subjectId: 's1', subjectName: 'Matematik' }],
    ['t3', { topicId: 't3', topicTitle: 'Optik', subjectId: 's2', subjectName: 'Fizik' }],
  ])

  const byTopic = [
    { topicId: 't1', total: 4, correct: 3, wrong: 1, blank: 0, net: 2.75 },
    { topicId: 't2', total: 2, correct: 1, wrong: 0, blank: 1, net: 1 },
    { topicId: 't3', total: 3, correct: 0, wrong: 2, blank: 1, net: -0.5 },
  ]

  it('aynı dersin konularını tek satırda toplar', () => {
    const groups = groupBySubject(byTopic, labels, 'Diğer')
    expect(groups).toHaveLength(2)
    const math = groups.find((group) => group.subjectId === 's1')
    expect(math).toMatchObject({
      subjectName: 'Matematik',
      total: 6,
      correct: 4,
      wrong: 1,
      blank: 1,
    })
  })

  it('etiketi olmayan konuyu yedek ada toplar, satırı düşürmez', () => {
    const groups = groupBySubject(
      [{ topicId: 'bilinmeyen', total: 2, correct: 1, wrong: 1, blank: 0, net: 0.75 }],
      labels,
      'Diğer',
    )
    expect(groups).toEqual([
      { subjectId: '__other__', subjectName: 'Diğer', total: 2, correct: 1, wrong: 1, blank: 0 },
    ])
  })

  it('ders adına göre Türkçe sıralar', () => {
    const groups = groupBySubject(byTopic, labels, 'Diğer')
    expect(groups.map((group) => group.subjectName)).toEqual(['Fizik', 'Matematik'])
  })

  it('boş kırılımda boş dizi döner', () => {
    expect(groupBySubject([], labels, 'Diğer')).toEqual([])
  })
})

describe('filterReview', () => {
  const questions = [
    { id: 'a', selectedOption: 'A', isCorrect: true },
    { id: 'b', selectedOption: 'C', isCorrect: false },
    { id: 'c', selectedOption: null, isCorrect: false },
  ]

  it('tümü süzgeci her soruyu döner', () => {
    expect(filterReview(questions, 'all')).toHaveLength(3)
  })

  it('yanlışlar boş bırakılanları içermez', () => {
    expect(filterReview(questions, 'wrong').map((q) => q.id)).toEqual(['b'])
  })

  it('boşlar yalnızca cevapsızları içerir', () => {
    expect(filterReview(questions, 'blank').map((q) => q.id)).toEqual(['c'])
  })

  it('girdi dizisini değiştirmez', () => {
    filterReview(questions, 'all')
    expect(questions).toHaveLength(3)
  })
})
