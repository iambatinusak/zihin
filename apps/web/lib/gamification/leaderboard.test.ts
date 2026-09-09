import { describe, expect, it } from 'vitest'
import { buildLeaderboard, sumWeeklyXp, type LeaderboardCandidate } from './leaderboard'

const ANON = 'Adı gizli öğrenci'

function candidate(overrides: Partial<LeaderboardCandidate> = {}): LeaderboardCandidate {
  return { userId: 'u1', displayName: 'Ada', xp: 10, optIn: true, ...overrides }
}

describe('buildLeaderboard — gizlilik', () => {
  it('sıralamaya katılmayanları tamamen eler', () => {
    const rows = buildLeaderboard(
      [
        candidate({ userId: 'a', displayName: 'Ada', xp: 100, optIn: true }),
        candidate({ userId: 'b', displayName: 'Boran', xp: 90, optIn: false }),
        candidate({ userId: 'c', displayName: 'Ceren', xp: 80, optIn: true }),
      ],
      null,
      ANON,
    )

    expect(rows.map((row) => row.displayName)).toEqual(['Ada', 'Ceren'])
    // Elenen satır sıra numarasını da tüketmez.
    expect(rows.map((row) => row.rank)).toEqual([1, 2])
  })

  it('görünen adı olmayan öğrenci anonim etiketle listelenir', () => {
    const rows = buildLeaderboard(
      [
        candidate({ userId: 'a', displayName: null, xp: 50 }),
        candidate({ userId: 'b', displayName: '   ', xp: 40 }),
      ],
      null,
      ANON,
    )

    expect(rows[0]?.displayName).toBe(ANON)
    expect(rows[1]?.displayName).toBe(ANON)
  })

  it('satırda yalnızca sıra, ad, XP ve kendi işareti vardır', () => {
    const rows = buildLeaderboard([candidate({ userId: 'a' })], 'a', ANON)
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'displayName',
      'isCurrentUser',
      'rank',
      'xp',
    ])
  })
})

describe('buildLeaderboard — sıralama', () => {
  it('XP azalan sıralanır', () => {
    const rows = buildLeaderboard(
      [
        candidate({ userId: 'a', displayName: 'Ada', xp: 10 }),
        candidate({ userId: 'b', displayName: 'Boran', xp: 30 }),
        candidate({ userId: 'c', displayName: 'Ceren', xp: 20 }),
      ],
      null,
      ANON,
    )
    expect(rows.map((row) => row.displayName)).toEqual(['Boran', 'Ceren', 'Ada'])
  })

  it('eşit XP eşit sıra alır, sonraki sıra atlanır', () => {
    const rows = buildLeaderboard(
      [
        candidate({ userId: 'a', displayName: 'Ada', xp: 30 }),
        candidate({ userId: 'b', displayName: 'Boran', xp: 30 }),
        candidate({ userId: 'c', displayName: 'Ceren', xp: 10 }),
      ],
      null,
      ANON,
    )
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3])
    // Eşitlikte kimliğe göre deterministik: aynı girdi hep aynı çıktı.
    expect(rows.map((row) => row.displayName)).toEqual(['Ada', 'Boran', 'Ceren'])
  })

  it('negatif ve geçersiz XP sıfır sayılır', () => {
    const rows = buildLeaderboard(
      [candidate({ userId: 'a', xp: -5 }), candidate({ userId: 'b', xp: Number.NaN })],
      null,
      ANON,
    )
    expect(rows.every((row) => row.xp === 0)).toBe(true)
  })
})

describe('buildLeaderboard — kendi satırı', () => {
  const many: LeaderboardCandidate[] = Array.from({ length: 60 }, (_, index) => ({
    userId: `u${String(index).padStart(2, '0')}`,
    displayName: `Öğrenci ${index}`,
    xp: 1000 - index,
    optIn: true,
  }))

  it('ilk 50 dışındaki kendi satırı sona eklenir', () => {
    const rows = buildLeaderboard(many, 'u55', ANON, 50)
    expect(rows).toHaveLength(51)
    expect(rows[50]?.isCurrentUser).toBe(true)
    expect(rows[50]?.rank).toBe(56)
  })

  it('ilk 50 içindeyse ikinci kez eklenmez', () => {
    const rows = buildLeaderboard(many, 'u02', ANON, 50)
    expect(rows).toHaveLength(50)
    expect(rows.filter((row) => row.isCurrentUser)).toHaveLength(1)
  })

  it('kendi satırı sıralamaya katılmıyorsa hiç görünmez', () => {
    const rows = buildLeaderboard(
      [
        candidate({ userId: 'a', displayName: 'Ada', xp: 100 }),
        candidate({ userId: 'me', displayName: 'Ben', xp: 5, optIn: false }),
      ],
      'me',
      ANON,
      1,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.isCurrentUser).toBe(false)
  })
})

describe('sumWeeklyXp', () => {
  it('kullanıcı başına toplar, null değerleri sıfır sayar', () => {
    const totals = sumWeeklyXp([
      { user_id: 'a', xp_earned: 10 },
      { user_id: 'a', xp_earned: 15 },
      { user_id: 'b', xp_earned: null },
    ])
    expect(totals.get('a')).toBe(25)
    expect(totals.get('b')).toBe(0)
  })
})
