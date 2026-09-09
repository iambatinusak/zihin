import { describe, expect, it } from 'vitest'

import {
  clampPosition,
  clampWatchDelta,
  COMPLETION_THRESHOLD,
  hasCrossedCompletionThreshold,
  isAlreadyCompleted,
  MAX_WATCH_DELTA_SECONDS,
  nextProgress,
  type VideoProgressState,
} from './progress'

describe('clampWatchDelta', () => {
  it('normal artışı tam sayıya indirger', () => {
    expect(clampWatchDelta(15.7)).toBe(15)
  })

  it('üst sınırı aşan artışı keser', () => {
    expect(clampWatchDelta(3600)).toBe(MAX_WATCH_DELTA_SECONDS)
  })

  it('negatif, sıfır ve geçersiz değerleri sıfırlar', () => {
    expect(clampWatchDelta(-10)).toBe(0)
    expect(clampWatchDelta(0)).toBe(0)
    expect(clampWatchDelta(Number.NaN)).toBe(0)
    expect(clampWatchDelta(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('clampPosition', () => {
  it('konumu video süresine sıkıştırır', () => {
    expect(clampPosition(500, 300)).toBe(300)
  })

  it('süre bilinmiyorsa yalnızca negatifi temizler', () => {
    expect(clampPosition(500, 0)).toBe(500)
    expect(clampPosition(-5, 0)).toBe(0)
  })
})

describe('nextProgress', () => {
  const previous: VideoProgressState = {
    lastPositionSeconds: 100,
    watchTimeSeconds: 90,
    completedAt: null,
  }

  it('ilk izlemede sıfırdan başlar', () => {
    expect(nextProgress(null, { positionSeconds: 12, watchedDeltaSeconds: 12 }, 600)).toEqual({
      lastPositionSeconds: 12,
      watchTimeSeconds: 12,
      completedAt: null,
    })
  })

  it('izleme süresini biriktirir, konumu değiştirir', () => {
    expect(nextProgress(previous, { positionSeconds: 130, watchedDeltaSeconds: 30 }, 600)).toEqual({
      lastPositionSeconds: 130,
      watchTimeSeconds: 120,
      completedAt: null,
    })
  })

  it('geriye sarmada konum düşer ama izleme süresi düşmez', () => {
    const result = nextProgress(previous, { positionSeconds: 20, watchedDeltaSeconds: 5 }, 600)
    expect(result.lastPositionSeconds).toBe(20)
    expect(result.watchTimeSeconds).toBe(95)
  })

  it('kurcalanmış artış toplamı şişiremez', () => {
    const result = nextProgress(previous, { positionSeconds: 200, watchedDeltaSeconds: 99999 }, 600)
    expect(result.watchTimeSeconds).toBe(90 + MAX_WATCH_DELTA_SECONDS)
  })

  it('mevcut tamamlanma damgasını korur', () => {
    const completed: VideoProgressState = { ...previous, completedAt: '2026-01-01T00:00:00Z' }
    expect(
      nextProgress(completed, { positionSeconds: 5, watchedDeltaSeconds: 5 }, 600).completedAt,
    ).toBe('2026-01-01T00:00:00Z')
  })
})

describe('hasCrossedCompletionThreshold', () => {
  const duration = 600
  const required = duration * COMPLETION_THRESHOLD // 540

  it('eşiğin hemen altında false', () => {
    expect(
      hasCrossedCompletionThreshold(
        { lastPositionSeconds: required - 1, watchTimeSeconds: 100 },
        duration,
      ),
    ).toBe(false)
  })

  it('eşikte true', () => {
    expect(
      hasCrossedCompletionThreshold(
        { lastPositionSeconds: required, watchTimeSeconds: 0 },
        duration,
      ),
    ).toBe(true)
  })

  it('yeterli izleme süresi tek başına eşiği geçirir', () => {
    expect(
      hasCrossedCompletionThreshold(
        { lastPositionSeconds: 10, watchTimeSeconds: required },
        duration,
      ),
    ).toBe(true)
  })

  it('süre bilinmiyorsa asla tamamlanmış saymaz', () => {
    expect(
      hasCrossedCompletionThreshold({ lastPositionSeconds: 9999, watchTimeSeconds: 9999 }, 0),
    ).toBe(false)
  })
})

describe('isAlreadyCompleted', () => {
  it('damga varsa true, yoksa false', () => {
    expect(isAlreadyCompleted(null)).toBe(false)
    expect(
      isAlreadyCompleted({ lastPositionSeconds: 0, watchTimeSeconds: 0, completedAt: null }),
    ).toBe(false)
    expect(
      isAlreadyCompleted({ lastPositionSeconds: 0, watchTimeSeconds: 0, completedAt: 'x' }),
    ).toBe(true)
  })
})
