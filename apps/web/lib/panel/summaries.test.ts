import { describe, expect, it } from 'vitest'
import { fill } from '@/lib/i18n'
import type { MasteryMap, SubjectAverage } from '@/lib/data/mastery'
import {
  countByStatus,
  flattenTopics,
  radarExtremes,
  shortWeekLabel,
  subjectAveragesFromMap,
  trendSummary,
} from './summaries'

function topic(id: string, status: 'unknown' | 'weak' | 'medium' | 'strong', mastery: number) {
  return {
    topicId: id,
    title: id,
    slug: id,
    orderIndex: 1,
    estimatedMinutes: 30,
    difficulty: 3,
    examWeight: 0.5,
    mastery,
    status,
    attemptsCount: status === 'unknown' ? 0 : 5,
    lastCalculatedAt: null,
  }
}

const map: MasteryMap = {
  subjects: [
    {
      subjectId: 'sub-1',
      name: 'Matematik',
      slug: 'matematik',
      orderIndex: 1,
      color: '#123456',
      topicCount: 3,
      averageMastery: 60,
      units: [
        {
          unitId: 'u1',
          name: 'Ünite 1',
          orderIndex: 1,
          averageMastery: 60,
          topics: [topic('t1', 'strong', 80), topic('t2', 'weak', 40)],
        },
        {
          unitId: 'u2',
          name: 'Ünite 2',
          orderIndex: 2,
          averageMastery: 35,
          topics: [topic('t3', 'unknown', 35)],
        },
      ],
    },
    {
      subjectId: 'sub-2',
      name: 'Türkçe',
      slug: 'turkce',
      orderIndex: 2,
      color: null,
      topicCount: 1,
      averageMastery: 70,
      units: [
        {
          unitId: 'u3',
          name: 'Ünite 3',
          orderIndex: 1,
          averageMastery: 70,
          topics: [topic('t4', 'medium', 70)],
        },
      ],
    },
  ],
  topicCount: 4,
  measuredTopicCount: 3,
  averageMastery: 56,
}

describe('fill', () => {
  it('yer tutucuları değerlerle değiştirir', () => {
    expect(fill('Puan {score}, {attempts} çözüm.', { score: 80, attempts: 12 })).toBe(
      'Puan 80, 12 çözüm.',
    )
  })

  it('karşılığı olmayan yer tutucuyu olduğu gibi bırakır', () => {
    expect(fill('{a} ve {b}', { a: 1 })).toBe('1 ve {b}')
  })
})

describe('countByStatus', () => {
  it('her bandı sayar', () => {
    expect(countByStatus(map)).toEqual({ unknown: 1, weak: 1, medium: 1, strong: 1 })
  })

  it('boş haritada tüm sayılar sıfırdır', () => {
    const empty: MasteryMap = {
      subjects: [],
      topicCount: 0,
      measuredTopicCount: 0,
      averageMastery: 0,
    }
    expect(countByStatus(empty)).toEqual({ unknown: 0, weak: 0, medium: 0, strong: 0 })
  })
})

describe('flattenTopics', () => {
  it('ünite sırasını koruyarak konuları düzleştirir', () => {
    const units = map.subjects[0]?.units ?? []
    expect(flattenTopics(units).map((entry) => entry.topicId)).toEqual(['t1', 't2', 't3'])
  })
})

describe('subjectAveragesFromMap', () => {
  it('ders başına ortalama ve ölçülen konu sayısı üretir', () => {
    expect(subjectAveragesFromMap(map)).toEqual([
      {
        subjectId: 'sub-1',
        name: 'Matematik',
        color: '#123456',
        orderIndex: 1,
        averageMastery: 60,
        topicCount: 3,
        measuredTopicCount: 2,
      },
      {
        subjectId: 'sub-2',
        name: 'Türkçe',
        color: null,
        orderIndex: 2,
        averageMastery: 70,
        topicCount: 1,
        measuredTopicCount: 1,
      },
    ])
  })
})

describe('trendSummary', () => {
  const template = 'Son {weeks} haftada {first} puandan {last} puana geldi.'
  const singleTemplate = 'Tek hafta: {last} puan.'

  it('nokta yoksa null döner', () => {
    expect(trendSummary({ points: [], template, singleTemplate })).toBeNull()
  })

  it('tek nokta için tekil şablonu kullanır', () => {
    const summary = trendSummary({
      points: [{ weekStart: '2026-01-05', averageMastery: 42, sampleCount: 3 }],
      template,
      singleTemplate,
    })
    expect(summary).toBe('Tek hafta: 42 puan.')
  })

  it('ilk ve son haftayı karşılaştırır', () => {
    const summary = trendSummary({
      points: [
        { weekStart: '2026-01-05', averageMastery: 40, sampleCount: 3 },
        { weekStart: '2026-01-12', averageMastery: 55, sampleCount: 4 },
      ],
      template,
      singleTemplate,
    })
    expect(summary).toBe('Son 2 haftada 40 puandan 55 puana geldi.')
  })
})

describe('radarExtremes', () => {
  const subjects: SubjectAverage[] = [
    {
      subjectId: 'a',
      name: 'A',
      color: null,
      orderIndex: 1,
      averageMastery: 30,
      topicCount: 1,
      measuredTopicCount: 1,
    },
    {
      subjectId: 'b',
      name: 'B',
      color: null,
      orderIndex: 2,
      averageMastery: 90,
      topicCount: 1,
      measuredTopicCount: 1,
    },
  ]

  it('en yüksek ve en düşük dersi bulur', () => {
    const extremes = radarExtremes(subjects)
    expect(extremes?.best.name).toBe('B')
    expect(extremes?.worst.name).toBe('A')
  })

  it('tek ders varsa ikisi de aynıdır', () => {
    const one = subjects.slice(0, 1)
    const extremes = radarExtremes(one)
    expect(extremes?.best.subjectId).toBe('a')
    expect(extremes?.worst.subjectId).toBe('a')
  })

  it('ders yoksa null döner', () => {
    expect(radarExtremes([])).toBeNull()
  })
})

describe('shortWeekLabel', () => {
  it('gün.ay biçimine kısaltır', () => {
    expect(shortWeekLabel('2026-01-05')).toBe('05.01')
  })

  it('beklenmeyen biçimi olduğu gibi bırakır', () => {
    expect(shortWeekLabel('2026')).toBe('2026')
  })
})
