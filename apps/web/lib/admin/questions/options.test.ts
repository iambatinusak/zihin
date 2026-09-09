import { describe, expect, it } from 'vitest'
import {
  isValidDifficulty,
  normalizeOptions,
  parseOptionKey,
  readOptions,
  validateOptions,
} from './options'

describe('parseOptionKey', () => {
  it('kabul edilen yazımları harfe çevirir', () => {
    for (const value of ['A', 'a', 'A)', 'a.', 'option_a', 'option a', 'şık a', ' A ']) {
      expect(parseOptionKey(value), value).toBe('A')
    }
  })

  it('geçersiz değerler null döner', () => {
    for (const value of ['F', 'AB', '', '1', null, undefined, 5, 'ı']) {
      expect(parseOptionKey(value), String(value)).toBeNull()
    }
  })
})

describe('normalizeOptions', () => {
  it('boş şıkları atar ve anahtarları baştan verir', () => {
    const { options, keyMap } = normalizeOptions([
      { key: 'A', text: ' bir ' },
      { key: 'B', text: '   ' },
      { key: 'C', text: 'üç' },
    ])

    expect(options).toEqual([
      { key: 'A', text: 'bir' },
      { key: 'B', text: 'üç' },
    ])
    // Ortadaki şık silinince C doğru şıksa B'ye taşınmalı.
    expect(keyMap).toEqual({ A: 'A', C: 'B' })
  })

  it('beşten fazla şık kabul etmez', () => {
    const { options } = normalizeOptions(
      Array.from({ length: 7 }, (_, index) => ({ text: `s${index}` })),
    )
    expect(options).toHaveLength(5)
  })
})

describe('validateOptions', () => {
  const two = [
    { key: 'A', text: 'bir' },
    { key: 'B', text: 'iki' },
  ] as const

  it('geçerli kümede null döner', () => {
    expect(validateOptions(two, 'B')).toBeNull()
  })

  it('iki şıktan az', () => {
    expect(validateOptions([{ key: 'A', text: 'bir' }], 'A')).toEqual({ kind: 'too_few' })
  })

  it('doğru şık tanınmıyor', () => {
    expect(validateOptions(two, 'Z')).toEqual({ kind: 'correct_missing' })
    expect(validateOptions(two, null)).toEqual({ kind: 'correct_missing' })
  })

  it('doğru şık listede yok', () => {
    expect(validateOptions(two, 'C')).toEqual({ kind: 'correct_missing' })
  })

  it('doğru şık boş', () => {
    const options = [
      { key: 'A', text: 'bir' },
      { key: 'B', text: 'iki' },
      { key: 'C', text: '  ' },
    ] as const
    expect(validateOptions(options, 'C')).toEqual({ kind: 'correct_empty', key: 'C' })
  })
})

describe('readOptions', () => {
  it('veritabanı jsonb değerini okur', () => {
    expect(
      readOptions([
        { key: 'A', text: 'bir' },
        { key: 'B', text: 'iki' },
      ]),
    ).toEqual([
      { key: 'A', text: 'bir' },
      { key: 'B', text: 'iki' },
    ])
  })

  it('beklenmeyen şekil boş dizi döner, çökmez', () => {
    expect(readOptions(null)).toEqual([])
    expect(readOptions('A, B')).toEqual([])
    expect(readOptions([{ key: 'Z', text: 'x' }, 3, null, { text: 'anahtarsız' }])).toEqual([])
  })
})

describe('isValidDifficulty', () => {
  it('1-5 arası tam sayı', () => {
    expect(isValidDifficulty(1)).toBe(true)
    expect(isValidDifficulty(5)).toBe(true)
    expect(isValidDifficulty(0)).toBe(false)
    expect(isValidDifficulty(6)).toBe(false)
    expect(isValidDifficulty(2.5)).toBe(false)
    expect(isValidDifficulty(Number.NaN)).toBe(false)
  })
})
