import { describe, expect, it } from 'vitest'
import {
  answeredIds,
  blankCount,
  cellStatus,
  crossedWarning,
  formatClock,
  optionIndexFromKey,
  remainingSeconds,
  wrapIndex,
} from './runner-state'

const START = '2026-01-01T10:00:00.000Z'
const startMs = Date.parse(START)

describe('remainingSeconds', () => {
  it('süresiz testte null döner', () => {
    expect(remainingSeconds(START, null, startMs)).toBeNull()
  })

  it('sıfır ya da negatif süreyi süresiz sayar', () => {
    expect(remainingSeconds(START, 0, startMs)).toBeNull()
    expect(remainingSeconds(START, -60, startMs)).toBeNull()
  })

  it('başlangıçtan itibaren geriye sayar', () => {
    expect(remainingSeconds(START, 600, startMs)).toBe(600)
    expect(remainingSeconds(START, 600, startMs + 60_000)).toBe(540)
  })

  it('yeniden yüklemede geçen süreyi hesaba katar (istemci sayacına güvenmez)', () => {
    // Sekme 9 dakika kapalı kaldı: kalan süre 1 dakika olmalı.
    expect(remainingSeconds(START, 600, startMs + 540_000)).toBe(60)
  })

  it('süre dolduğunda negatife düşmez', () => {
    expect(remainingSeconds(START, 600, startMs + 900_000)).toBe(0)
  })

  it('okunamayan başlangıç damgasında sayaç göstermez', () => {
    expect(remainingSeconds('dün', 600, startMs)).toBeNull()
  })
})

describe('formatClock', () => {
  it('bir saatin altında ss:dd yazar', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65)).toBe('01:05')
    expect(formatClock(600)).toBe('10:00')
  })

  it('bir saatin üstünde s:dd:ss yazar', () => {
    expect(formatClock(3661)).toBe('1:01:01')
  })

  it('negatif ve geçersiz değerleri sıfır sayar', () => {
    expect(formatClock(-5)).toBe('00:00')
    expect(formatClock(Number.NaN)).toBe('00:00')
  })
})

describe('crossedWarning', () => {
  it('eşiğin üstünden altına inince uyarır', () => {
    expect(crossedWarning(301, 300)).toBe(300)
    expect(crossedWarning(61, 60)).toBe(60)
  })

  it('aynı eşikte kalırken tekrar uyarmaz', () => {
    expect(crossedWarning(300, 299)).toBeNull()
    expect(crossedWarning(60, 59)).toBeNull()
  })

  it('eşiğin zaten altındaysa uyarmaz', () => {
    expect(crossedWarning(200, 199)).toBeNull()
  })

  it('bir tikte iki eşik birden geçilirse en büyüğünü bildirir', () => {
    expect(crossedWarning(400, 30)).toBe(300)
  })
})

describe('optionIndexFromKey', () => {
  it('1-9 tuşlarını sıfır tabanlı indekse çevirir', () => {
    expect(optionIndexFromKey('1')).toBe(0)
    expect(optionIndexFromKey('5')).toBe(4)
    expect(optionIndexFromKey('9')).toBe(8)
  })

  it('sıfır, harf ve çok karakterli tuşları yok sayar', () => {
    expect(optionIndexFromKey('0')).toBeNull()
    expect(optionIndexFromKey('a')).toBeNull()
    expect(optionIndexFromKey('Enter')).toBeNull()
    expect(optionIndexFromKey('')).toBeNull()
  })
})

describe('blankCount / answeredIds', () => {
  const order = ['q1', 'q2', 'q3']

  it('hiç cevap yoksa hepsi boştur', () => {
    expect(blankCount(order, new Map())).toBe(3)
    expect(answeredIds(order, new Map()).size).toBe(0)
  })

  it('şıkkı geri alınmış soruyu boş sayar', () => {
    const answers = new Map([
      ['q1', 'A'],
      ['q2', null],
    ])
    expect(blankCount(order, answers)).toBe(2)
    expect([...answeredIds(order, answers)]).toEqual(['q1'])
  })

  it('sıraya girmemiş cevabı saymaz', () => {
    const answers = new Map([['baska-soru', 'B']])
    expect(blankCount(order, answers)).toBe(3)
  })
})

describe('cellStatus', () => {
  const answers = new Map([['q1', 'A']])

  it('cevapsız soruyu boş gösterir', () => {
    expect(cellStatus('q2', answers, new Set())).toBe('blank')
  })

  it('cevaplı soruyu cevaplı gösterir', () => {
    expect(cellStatus('q1', answers, new Set())).toBe('answered')
  })

  it('işaret cevaplıya baskındır', () => {
    expect(cellStatus('q1', answers, new Set(['q1']))).toBe('flagged')
    expect(cellStatus('q2', answers, new Set(['q2']))).toBe('flagged')
  })
})

describe('wrapIndex', () => {
  it('aralık içinde değiştirmez', () => {
    expect(wrapIndex(2, 5)).toBe(2)
  })

  it('sondan başa, baştan sona sarar', () => {
    expect(wrapIndex(5, 5)).toBe(0)
    expect(wrapIndex(-1, 5)).toBe(4)
  })

  it('boş listede sıfır döner', () => {
    expect(wrapIndex(3, 0)).toBe(0)
  })
})
