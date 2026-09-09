import { describe, expect, it } from 'vitest'
import { countdownTarget, isMockStartable, isRankingVisible, mockWindowState } from './window'

const START = '2026-03-01T10:00:00.000Z'
const END = '2026-03-01T13:00:00.000Z'

function at(iso: string): Date {
  return new Date(iso)
}

describe('mockWindowState', () => {
  it('penceresiz denemede none döner', () => {
    const state = mockWindowState(
      { live_window_start: null, live_window_end: null },
      at('2026-03-01T11:00:00.000Z'),
    )
    expect(state).toBe('none')
  })

  it('pencere açılmadan önce before döner', () => {
    const state = mockWindowState(
      { live_window_start: START, live_window_end: END },
      at('2026-03-01T09:59:59.999Z'),
    )
    expect(state).toBe('before')
  })

  it('pencerenin içinde open döner', () => {
    const state = mockWindowState(
      { live_window_start: START, live_window_end: END },
      at('2026-03-01T11:30:00.000Z'),
    )
    expect(state).toBe('open')
  })

  it('pencere kapandıktan sonra closed döner', () => {
    const state = mockWindowState(
      { live_window_start: START, live_window_end: END },
      at('2026-03-01T13:00:00.001Z'),
    )
    expect(state).toBe('closed')
  })

  it('başlangıç anı açık, bitiş anı kapalı sayılır', () => {
    const mock = { live_window_start: START, live_window_end: END }
    expect(mockWindowState(mock, at(START))).toBe('open')
    expect(mockWindowState(mock, at(END))).toBe('closed')
  })

  it('yalnızca başlangıç varsa pencere sonsuza kadar açık kalır', () => {
    const mock = { live_window_start: START, live_window_end: null }
    expect(mockWindowState(mock, at('2026-03-01T09:00:00.000Z'))).toBe('before')
    expect(mockWindowState(mock, at('2027-01-01T00:00:00.000Z'))).toBe('open')
  })

  it('yalnızca bitiş varsa pencere baştan açıktır', () => {
    const mock = { live_window_start: null, live_window_end: END }
    expect(mockWindowState(mock, at('2020-01-01T00:00:00.000Z'))).toBe('open')
    expect(mockWindowState(mock, at('2026-03-01T14:00:00.000Z'))).toBe('closed')
  })

  it('okunamayan damga yok sayılır, öğrenci denemeden mahrum kalmaz', () => {
    const state = mockWindowState(
      { live_window_start: 'ne zaman olsa olur', live_window_end: '   ' },
      at('2026-03-01T11:00:00.000Z'),
    )
    expect(state).toBe('none')
  })
})

describe('isMockStartable', () => {
  it('yalnızca none ve open durumlarında başlatılabilir', () => {
    expect(isMockStartable('none')).toBe(true)
    expect(isMockStartable('open')).toBe(true)
    expect(isMockStartable('before')).toBe(false)
    expect(isMockStartable('closed')).toBe(false)
  })
})

describe('isRankingVisible', () => {
  it('sıralama pencere kapandıktan sonra ve penceresiz denemede görünür', () => {
    expect(isRankingVisible('closed')).toBe(true)
    expect(isRankingVisible('none')).toBe(true)
  })

  it('pencere sürerken sıralama gizlidir', () => {
    expect(isRankingVisible('open')).toBe(false)
    expect(isRankingVisible('before')).toBe(false)
  })
})

describe('countdownTarget', () => {
  const mock = { live_window_start: START, live_window_end: END }

  it('açılmadan önce başlangıca, açıkken bitişe sayar', () => {
    expect(countdownTarget(mock, 'before')).toBe(START)
    expect(countdownTarget(mock, 'open')).toBe(END)
  })

  it('kapalı ve penceresiz durumda sayılacak bir şey yok', () => {
    expect(countdownTarget(mock, 'closed')).toBeNull()
    expect(countdownTarget({ live_window_start: null, live_window_end: null }, 'none')).toBeNull()
  })
})
