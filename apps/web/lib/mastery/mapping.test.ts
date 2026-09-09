import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPECTED_SECONDS } from '@zihin/core'
import {
  dedupeTopicIds,
  FALLBACK_DIFFICULTY,
  isWeakToStrongTransition,
  toAttemptLike,
  toAttemptLikes,
  type MasteryAttemptRow,
} from './mapping'

function row(overrides: Partial<MasteryAttemptRow> = {}): MasteryAttemptRow {
  return {
    question_id: 'q1',
    is_correct: true,
    time_spent_ms: 45_000,
    answered_at: '2026-09-01T10:00:00.000Z',
    repeat_index: 0,
    difficulty: 4,
    expected_seconds: 90,
    ...overrides,
  }
}

describe('toAttemptLike', () => {
  it('satırı core sözleşmesine birebir taşır', () => {
    expect(toAttemptLike(row())).toEqual({
      questionId: 'q1',
      isCorrect: true,
      difficulty: 4,
      timeSpentMs: 45_000,
      expectedSeconds: 90,
      answeredAt: '2026-09-01T10:00:00.000Z',
      repeatIndex: 0,
    })
  })

  it('expected_seconds null ise zorluktan türetilen varsayılanı kullanır', () => {
    const mapped = toAttemptLike(row({ expected_seconds: null, difficulty: 5 }))
    expect(mapped.expectedSeconds).toBe(DEFAULT_EXPECTED_SECONDS(5))
    expect(mapped.expectedSeconds).toBe(160)
  })

  it('expected_seconds 0 ya da negatifse varsayılana düşer', () => {
    expect(toAttemptLike(row({ expected_seconds: 0, difficulty: 1 })).expectedSeconds).toBe(
      DEFAULT_EXPECTED_SECONDS(1),
    )
    expect(toAttemptLike(row({ expected_seconds: -30, difficulty: 2 })).expectedSeconds).toBe(
      DEFAULT_EXPECTED_SECONDS(2),
    )
  })

  it('difficulty null ise orta zorluk varsayılır ve süre ondan türetilir', () => {
    const mapped = toAttemptLike(row({ difficulty: null, expected_seconds: null }))
    expect(mapped.difficulty).toBe(FALLBACK_DIFFICULTY)
    expect(mapped.expectedSeconds).toBe(DEFAULT_EXPECTED_SECONDS(FALLBACK_DIFFICULTY))
  })

  it('tekrar sırasını korur — core tekrarları düşük ağırlıkla hesaba katar', () => {
    expect(toAttemptLike(row({ repeat_index: 3 })).repeatIndex).toBe(3)
  })

  it('yanlış cevabı yanlış olarak taşır', () => {
    expect(toAttemptLike(row({ is_correct: false })).isCorrect).toBe(false)
  })

  it('toAttemptLikes sırayı korur', () => {
    const mapped = toAttemptLikes([row({ question_id: 'a' }), row({ question_id: 'b' })])
    expect(mapped.map((item) => item.questionId)).toEqual(['a', 'b'])
  })
})

describe('isWeakToStrongTransition', () => {
  it('zayıftan güçlüye geçişi saptar', () => {
    expect(isWeakToStrongTransition('weak', 'strong')).toBe(true)
  })

  it('ilk ölçüm güçlü çıkarsa geçiş sayılmaz', () => {
    expect(isWeakToStrongTransition(null, 'strong')).toBe(false)
    expect(isWeakToStrongTransition('unknown', 'strong')).toBe(false)
  })

  it('ara duraklar ve geri gidişler geçiş değildir', () => {
    expect(isWeakToStrongTransition('weak', 'medium')).toBe(false)
    expect(isWeakToStrongTransition('medium', 'strong')).toBe(false)
    expect(isWeakToStrongTransition('strong', 'strong')).toBe(false)
    expect(isWeakToStrongTransition('strong', 'weak')).toBe(false)
  })
})

describe('dedupeTopicIds', () => {
  it('tekrarları eler ve ilk görülme sırasını korur', () => {
    expect(dedupeTopicIds(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c'])
  })

  it('boş kimlikleri atar', () => {
    expect(dedupeTopicIds(['', 'a', ''])).toEqual(['a'])
  })

  it('boş listeyle boş döner', () => {
    expect(dedupeTopicIds([])).toEqual([])
  })
})
