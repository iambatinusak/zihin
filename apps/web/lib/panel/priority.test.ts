import { describe, expect, it } from 'vitest'
import type { MasteryMap } from '@/lib/data/mastery'
import { buildTopicIndex, cardsHref, pickFirstVideoIds, topicHref } from './priority'

function makeMap(): MasteryMap {
  return {
    subjects: [
      {
        subjectId: 'sub-1',
        name: 'Matematik',
        slug: 'matematik',
        orderIndex: 1,
        color: null,
        topicCount: 2,
        averageMastery: 50,
        units: [
          {
            unitId: 'unit-1',
            name: 'Temel Kavramlar',
            orderIndex: 1,
            averageMastery: 50,
            topics: [
              {
                topicId: 'topic-1',
                title: 'Sayı Basamakları',
                slug: 'sayi-basamaklari',
                orderIndex: 1,
                estimatedMinutes: 30,
                difficulty: 3,
                examWeight: 0.4,
                mastery: 80,
                status: 'strong',
                attemptsCount: 12,
                lastCalculatedAt: '2026-01-01T00:00:00Z',
              },
              {
                topicId: 'topic-2',
                title: 'Bölünebilme',
                slug: 'bolunebilme',
                orderIndex: 2,
                estimatedMinutes: 40,
                difficulty: 4,
                examWeight: 0.6,
                mastery: 35,
                status: 'unknown',
                attemptsCount: 0,
                lastCalculatedAt: null,
              },
            ],
          },
        ],
      },
    ],
    topicCount: 2,
    measuredTopicCount: 1,
    averageMastery: 58,
  }
}

describe('buildTopicIndex', () => {
  it('konuyu ders ve ünite bilgisiyle birlikte dizine alır', () => {
    const index = buildTopicIndex(makeMap())

    expect(index.size).toBe(2)
    expect(index.get('topic-1')).toEqual({
      topicSlug: 'sayi-basamaklari',
      attemptsCount: 12,
      subjectName: 'Matematik',
      subjectSlug: 'matematik',
      unitId: 'unit-1',
      unitName: 'Temel Kavramlar',
    })
  })

  it('ölçülmemiş konuyu da dizine alır (listeden düşmez)', () => {
    expect(buildTopicIndex(makeMap()).get('topic-2')?.attemptsCount).toBe(0)
  })

  it('boş haritada boş dizin döner', () => {
    const empty: MasteryMap = {
      subjects: [],
      topicCount: 0,
      measuredTopicCount: 0,
      averageMastery: 0,
    }
    expect(buildTopicIndex(empty).size).toBe(0)
  })
})

describe('topicHref', () => {
  it('üç slug tamsa yolu üretir', () => {
    expect(topicHref('matematik', 'temel', 'sayilar')).toBe('/dersler/matematik/temel/sayilar')
  })

  it.each([
    [null, 'temel', 'sayilar'],
    ['matematik', null, 'sayilar'],
    ['matematik', 'temel', null],
    ['', 'temel', 'sayilar'],
  ] as const)('eksik slug varsa null döner (%s, %s, %s)', (subject, unit, topic) => {
    expect(topicHref(subject, unit, topic)).toBeNull()
  })
})

describe('cardsHref', () => {
  it('konu kimliğini sorgu parametresine kodlar', () => {
    expect(cardsHref('a b&c')).toBe('/kartlar?topic=a%20b%26c')
  })
})

describe('pickFirstVideoIds', () => {
  it('konu başına en düşük order_index kazanır', () => {
    const map = pickFirstVideoIds([
      { id: 'v2', topic_id: 't1', order_index: 2 },
      { id: 'v1', topic_id: 't1', order_index: 1 },
      { id: 'v3', topic_id: 't2', order_index: 5 },
    ])

    expect(map.get('t1')).toBe('v1')
    expect(map.get('t2')).toBe('v3')
  })

  it('videosu olmayan konu haritada yer almaz', () => {
    expect(pickFirstVideoIds([]).size).toBe(0)
    expect(pickFirstVideoIds([{ id: 'v1', topic_id: 't1', order_index: 0 }]).has('t9')).toBe(false)
  })
})
