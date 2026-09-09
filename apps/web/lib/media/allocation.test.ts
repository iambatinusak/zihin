import { describe, expect, it } from 'vitest'
import { allocateMockSections, pickRandom, type SectionRequest } from './allocation'

const requests: SectionRequest[] = [
  { subjectId: 'turkce', subjectName: 'Türkçe', requested: 40 },
  { subjectId: 'matematik', subjectName: 'Matematik', requested: 40 },
]

describe('allocateMockSections', () => {
  it('havuz yeterliyse istenen sayıyı verir', () => {
    const result = allocateMockSections(requests, { turkce: 100, matematik: 100 })
    expect(result.totalTaken).toBe(80)
    expect(result.hasShortfall).toBe(false)
    expect(result.isEmpty).toBe(false)
  })

  it('KISA HAVUZ normal durumdur: kırpar, hata saymaz', () => {
    const result = allocateMockSections(requests, { turkce: 6, matematik: 0 })
    expect(result.sections).toEqual([
      {
        subjectId: 'turkce',
        subjectName: 'Türkçe',
        requested: 40,
        available: 6,
        taken: 6,
        shortfall: 34,
      },
      {
        subjectId: 'matematik',
        subjectName: 'Matematik',
        requested: 40,
        available: 0,
        taken: 0,
        shortfall: 40,
      },
    ])
    expect(result.totalTaken).toBe(6)
    expect(result.hasShortfall).toBe(true)
    expect(result.isEmpty).toBe(false)
  })

  it('bir dersin fazlasını başka derse aktarmaz', () => {
    const result = allocateMockSections(requests, { turkce: 500, matematik: 2 })
    expect(result.sections[0]?.taken).toBe(40)
    expect(result.sections[1]?.taken).toBe(2)
    expect(result.totalTaken).toBe(42)
  })

  it('hiç soru bulunamazsa isEmpty olur', () => {
    const result = allocateMockSections(requests, {})
    expect(result.totalTaken).toBe(0)
    expect(result.isEmpty).toBe(true)
  })

  it('istenmeyen (0 ya da negatif) dersleri tamamen düşürür', () => {
    const result = allocateMockSections(
      [
        { subjectId: 'turkce', subjectName: 'Türkçe', requested: 0 },
        { subjectId: 'matematik', subjectName: 'Matematik', requested: -3 },
        { subjectId: 'fen', subjectName: 'Fen Bilimleri', requested: 5 },
      ],
      { turkce: 50, matematik: 50, fen: 50 },
    )
    expect(result.sections.map((section) => section.subjectId)).toEqual(['fen'])
    expect(result.totalRequested).toBe(5)
  })

  it('bilinmeyen ders kimliğini sıfır havuz sayar', () => {
    const result = allocateMockSections([{ subjectId: 'yok', subjectName: 'Yok', requested: 10 }], {
      turkce: 10,
    })
    expect(result.sections[0]?.available).toBe(0)
  })

  it('bölüm adını olduğu gibi taşır (test_questions.section eşleşmesi)', () => {
    const result = allocateMockSections(requests, { turkce: 3, matematik: 3 })
    expect(result.sections.map((section) => section.subjectName)).toEqual(['Türkçe', 'Matematik'])
  })
})

describe('pickRandom', () => {
  /** Belirlenimci "rastgele": her zaman ilk adayı seçer. */
  const first = () => 0

  it('istenen sayıda öğe döner', () => {
    expect(pickRandom(['a', 'b', 'c', 'd'], 2, first)).toHaveLength(2)
  })

  it('havuzdan fazlası istenirse havuz kadarını döner', () => {
    expect(pickRandom(['a', 'b'], 10, first)).toHaveLength(2)
  })

  it('kaynak diziyi değiştirmez', () => {
    const pool = ['a', 'b', 'c']
    pickRandom(pool, 3, () => 0.99)
    expect(pool).toEqual(['a', 'b', 'c'])
  })

  it('aynı öğeyi iki kez seçmez', () => {
    const picked = pickRandom(['a', 'b', 'c', 'd', 'e'], 5, () => 0.5)
    expect(new Set(picked).size).toBe(5)
  })

  it('sıfır ya da negatif sayıda boş dizi döner', () => {
    expect(pickRandom(['a'], 0, first)).toEqual([])
    expect(pickRandom(['a'], -1, first)).toEqual([])
  })
})
