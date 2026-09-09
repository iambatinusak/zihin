import { describe, expect, it } from 'vitest'
import type { StudyBlockDraft } from '@zihin/core'

import {
  compareBlocksForDisplay,
  mergeWithPreserved,
  resolveBlockContent,
  selectTestByTopic,
  selectVideoByTopic,
  type PreservedBlock,
} from './blocks'

function draft(partial: Partial<StudyBlockDraft>): StudyBlockDraft {
  return {
    scheduledDate: '2025-05-12',
    orderIndex: 0,
    type: 'watch',
    topicId: 't1',
    estimatedMinutes: 30,
    title: 'İzle: Konu',
    ...partial,
  }
}

describe('selectVideoByTopic', () => {
  it('ders anlatımını çözüm videosuna tercih eder', () => {
    const map = selectVideoByTopic([
      { id: 'v-solution', topicId: 't1', type: 'solution', orderIndex: 0 },
      { id: 'v-lecture', topicId: 't1', type: 'lecture', orderIndex: 5 },
    ])
    expect(map.get('t1')).toBe('v-lecture')
  })

  it('aynı tipte müfredat sırasına bakar', () => {
    const map = selectVideoByTopic([
      { id: 'v-b', topicId: 't1', type: 'lecture', orderIndex: 2 },
      { id: 'v-a', topicId: 't1', type: 'lecture', orderIndex: 1 },
    ])
    expect(map.get('t1')).toBe('v-a')
  })

  it('sıra da eşitse kimliğe göre kararlıdır (deterministik)', () => {
    const rows = [
      { id: 'b', topicId: 't1', type: 'lecture', orderIndex: 0 },
      { id: 'a', topicId: 't1', type: 'lecture', orderIndex: 0 },
    ]
    expect(selectVideoByTopic(rows).get('t1')).toBe('a')
    expect(selectVideoByTopic([...rows].reverse()).get('t1')).toBe('a')
  })

  it('bilinmeyen tip en sona düşer', () => {
    const map = selectVideoByTopic([
      { id: 'v-x', topicId: 't1', type: 'podcast', orderIndex: 0 },
      { id: 'v-l', topicId: 't1', type: 'lecture', orderIndex: 9 },
    ])
    expect(map.get('t1')).toBe('v-l')
  })

  it('boş listede boş harita döner', () => {
    expect(selectVideoByTopic([]).size).toBe(0)
  })
})

describe('selectTestByTopic', () => {
  it('konu testini ünite testine tercih eder', () => {
    const map = selectTestByTopic([
      { id: 'unit', topicId: 't1', type: 'unit_test' },
      { id: 'topic', topicId: 't1', type: 'topic_test' },
    ])
    expect(map.get('t1')).toBe('topic')
  })
})

describe('resolveBlockContent', () => {
  const videos = new Map([['t1', 'v1']])
  const tests = new Map([['t1', 'x1']])

  it('izleme bloğuna video, çözme bloğuna test bağlar', () => {
    expect(resolveBlockContent('watch', 't1', videos, tests)).toEqual({
      videoId: 'v1',
      testId: null,
    })
    expect(resolveBlockContent('solve', 't1', videos, tests)).toEqual({
      videoId: null,
      testId: 'x1',
    })
  })

  it('tekrar ve deneme bloğu içerik taşımaz', () => {
    expect(resolveBlockContent('review', 't1', videos, tests)).toEqual({
      videoId: null,
      testId: null,
    })
    expect(resolveBlockContent('mock', null, videos, tests)).toEqual({
      videoId: null,
      testId: null,
    })
  })

  it('içeriği olmayan konu blok üretmeyi ENGELLEMEZ, yalnızca null döner', () => {
    expect(resolveBlockContent('watch', 'bos-konu', videos, tests)).toEqual({
      videoId: null,
      testId: null,
    })
  })
})

describe('mergeWithPreserved', () => {
  const preserved: PreservedBlock[] = [
    { id: 'p1', scheduledDate: '2025-05-12', orderIndex: 0, type: 'watch', topicId: 't1' },
    { id: 'p2', scheduledDate: '2025-05-12', orderIndex: 1, type: 'solve', topicId: 't1' },
  ]

  it('tamamlanmış işi yeniden programlamaz', () => {
    const result = mergeWithPreserved(
      [draft({ type: 'watch', topicId: 't1' }), draft({ type: 'watch', topicId: 't2' })],
      preserved,
    )
    expect(result.skipped).toBe(1)
    expect(result.drafts).toHaveLength(1)
    expect(result.drafts[0]?.topicId).toBe('t2')
  })

  it('kalan taslakları korunanların ardına kaydırır', () => {
    const result = mergeWithPreserved(
      [
        draft({ topicId: 't2', orderIndex: 0 }),
        draft({ topicId: 't3', orderIndex: 1 }),
        draft({ topicId: 't4', orderIndex: 0, scheduledDate: '2025-05-13' }),
      ],
      preserved,
    )
    expect(result.drafts.map((block) => block.orderIndex)).toEqual([2, 3, 0])
  })

  it('haftanın denemesi zaten yapıldıysa ikincisini üretmez', () => {
    const done: PreservedBlock[] = [
      { id: 'm', scheduledDate: '2025-05-17', orderIndex: 4, type: 'mock', topicId: null },
    ]
    const result = mergeWithPreserved(
      [draft({ type: 'mock', topicId: null, scheduledDate: '2025-05-18' })],
      done,
    )
    expect(result.drafts).toHaveLength(0)
    expect(result.skipped).toBe(1)
  })

  it('korunan blok yoksa taslaklar olduğu gibi kalır', () => {
    const drafts = [draft({ orderIndex: 0 }), draft({ orderIndex: 1 })]
    const result = mergeWithPreserved(drafts, [])
    expect(result.skipped).toBe(0)
    expect(result.drafts.map((block) => block.orderIndex)).toEqual([0, 1])
  })

  it('aynı konunun FARKLI tipteki bloğu korunmaz sayılmaz', () => {
    const result = mergeWithPreserved([draft({ type: 'review', topicId: 't1' })], preserved)
    expect(result.drafts).toHaveLength(1)
  })
})

describe('compareBlocksForDisplay', () => {
  it('sıra numarası, sonra kimlik', () => {
    const rows = [
      { orderIndex: 1, id: 'b' },
      { orderIndex: 0, id: 'z' },
      { orderIndex: 1, id: 'a' },
    ]
    expect([...rows].sort(compareBlocksForDisplay).map((row) => row.id)).toEqual(['z', 'a', 'b'])
  })
})
