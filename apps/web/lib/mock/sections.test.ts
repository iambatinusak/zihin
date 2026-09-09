import { describe, expect, it } from 'vitest'
import {
  UNSECTIONED_KEY,
  groupSections,
  sectionKeyOfQuestion,
  sectionProgress,
  totalProgress,
} from './sections'

const QUESTIONS = [
  { questionId: 'q1', section: 'Türkçe' },
  { questionId: 'q2', section: 'Türkçe' },
  { questionId: 'q3', section: 'Matematik' },
  { questionId: 'q4', section: 'Matematik' },
  { questionId: 'q5', section: 'Fen Bilimleri' },
]

describe('groupSections', () => {
  it('bölümleri ilk görülme sırasına göre diziyor', () => {
    const sections = groupSections(QUESTIONS, 'Diğer')
    expect(sections.map((section) => section.name)).toEqual([
      'Türkçe',
      'Matematik',
      'Fen Bilimleri',
    ])
    expect(sections[0]?.questionIds).toEqual(['q1', 'q2'])
  })

  it('bölümü olmayan sorular tek bir "diğer" grubunda toplanır', () => {
    const sections = groupSections(
      [
        { questionId: 'q1', section: null },
        { questionId: 'q2', section: '   ' },
        { questionId: 'q3', section: 'Matematik' },
      ],
      'Diğer',
    )
    expect(sections).toHaveLength(2)
    expect(sections[0]).toMatchObject({
      key: UNSECTIONED_KEY,
      name: 'Diğer',
      questionIds: ['q1', 'q2'],
    })
  })

  it('boş soru listesinde boş dizi döner', () => {
    expect(groupSections([], 'Diğer')).toEqual([])
  })
})

describe('sectionProgress', () => {
  const sections = groupSections(QUESTIONS, 'Diğer')

  it('hiç cevaplanmamış bölüm 0/n gösterir, çökmez', () => {
    const progress = sectionProgress(sections, new Map())
    expect(progress).toEqual([
      { key: 'Türkçe', name: 'Türkçe', total: 2, answered: 0 },
      { key: 'Matematik', name: 'Matematik', total: 2, answered: 0 },
      { key: 'Fen Bilimleri', name: 'Fen Bilimleri', total: 1, answered: 0 },
    ])
  })

  it('bir bölüm doluyken diğeri sıfır kalabilir', () => {
    const answers = new Map<string, string | null>([
      ['q1', 'A'],
      ['q2', 'C'],
    ])
    const progress = sectionProgress(sections, answers)
    expect(progress[0]?.answered).toBe(2)
    expect(progress[1]?.answered).toBe(0)
    expect(progress[2]?.answered).toBe(0)
  })

  it('şıkkı geri alınmış soru cevaplanmamış sayılır', () => {
    const answers = new Map<string, string | null>([
      ['q1', null],
      ['q2', 'B'],
    ])
    expect(sectionProgress(sections, answers)[0]?.answered).toBe(1)
  })

  it('oturumda olmayan bir cevap hiçbir bölümü şişirmez', () => {
    const answers = new Map<string, string | null>([['bilinmeyen', 'A']])
    expect(totalProgress(sectionProgress(sections, answers))).toEqual({ answered: 0, total: 5 })
  })
})

describe('totalProgress', () => {
  it('bölüm toplamlarını toplar', () => {
    const sections = groupSections(QUESTIONS, 'Diğer')
    const answers = new Map<string, string | null>([
      ['q1', 'A'],
      ['q5', 'E'],
    ])
    expect(totalProgress(sectionProgress(sections, answers))).toEqual({ answered: 2, total: 5 })
  })

  it('bölümsüz denemede sıfırlarla döner', () => {
    expect(totalProgress([])).toEqual({ answered: 0, total: 0 })
  })
})

describe('sectionKeyOfQuestion', () => {
  const sections = groupSections(QUESTIONS, 'Diğer')

  it('sorunun bölümünü bulur', () => {
    expect(sectionKeyOfQuestion(sections, 'q4')).toBe('Matematik')
  })

  it('tanımadığı soruda null döner', () => {
    expect(sectionKeyOfQuestion(sections, 'yok')).toBeNull()
  })
})
