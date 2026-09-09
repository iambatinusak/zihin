import { describe, expect, it } from 'vitest'
import { mockAttemptState } from './status'

const NOW = new Date('2026-03-01T12:00:00.000Z')

const FUTURE = '2026-03-02T12:00:00.000Z'
const PAST = '2026-02-28T12:00:00.000Z'

describe('mockAttemptState', () => {
  it('hiç oturum yoksa çözülmedi', () => {
    expect(mockAttemptState([], NOW)).toEqual({ kind: 'not_started' })
  })

  it('süresi dolmuş yarım oturum çözülmedi sayılır', () => {
    const state = mockAttemptState(
      [{ id: 's1', finished_at: null, expires_at: PAST, started_at: PAST }],
      NOW,
    )
    expect(state).toEqual({ kind: 'not_started' })
  })

  it('sürdürülebilir oturum devam ediyor döner', () => {
    const state = mockAttemptState(
      [{ id: 's1', finished_at: null, expires_at: FUTURE, started_at: PAST }],
      NOW,
    )
    expect(state).toEqual({ kind: 'in_progress', sessionId: 's1', startedAt: PAST })
  })

  it('yarım oturum, bitmiş oturuma baskındır', () => {
    const state = mockAttemptState(
      [
        { id: 'bitti', finished_at: PAST, expires_at: PAST, started_at: PAST },
        { id: 'devam', finished_at: null, expires_at: FUTURE, started_at: NOW.toISOString() },
      ],
      NOW,
    )
    expect(state).toMatchObject({ kind: 'in_progress', sessionId: 'devam' })
  })

  it('birden fazla bitmiş oturumda en yenisi gösterilir', () => {
    const state = mockAttemptState(
      [
        { id: 'eski', finished_at: '2026-01-01T00:00:00.000Z', expires_at: PAST, started_at: PAST },
        { id: 'yeni', finished_at: '2026-02-20T00:00:00.000Z', expires_at: PAST, started_at: PAST },
      ],
      NOW,
    )
    expect(state).toMatchObject({ kind: 'finished', sessionId: 'yeni' })
  })
})
