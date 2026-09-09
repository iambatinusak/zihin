import { describe, expect, it } from 'vitest'
import { amountsEqual, monthlyEquivalent, providerPrice, toAmount } from './money'

describe('toAmount', () => {
  it('PostgREST numeric kolonunu metin olarak döndürdüğünde de sayı üretir', () => {
    expect(toAmount('2490.00')).toBe(2490)
    expect(toAmount(2490)).toBe(2490)
  })

  it('okunamayan değeri sıfır sayar', () => {
    expect(toAmount(null)).toBe(0)
    expect(toAmount(undefined)).toBe(0)
    expect(toAmount('bedava')).toBe(0)
    expect(toAmount(Number.NaN)).toBe(0)
  })
})

describe('amountsEqual', () => {
  it('kuruş farkını yakalar', () => {
    expect(amountsEqual(2490, 2489.99)).toBe(false)
  })

  it('kayan nokta gürültüsünü tolere eder', () => {
    expect(amountsEqual(0.1 + 0.2, 0.3)).toBe(true)
  })
})

describe('providerPrice', () => {
  it('her zaman iki ondalık ve nokta ayraç kullanır', () => {
    expect(providerPrice(2490)).toBe('2490.00')
    expect(providerPrice(1990.5)).toBe('1990.50')
  })
})

describe('monthlyEquivalent', () => {
  it('yıllık pakette aylık karşılığı verir', () => {
    expect(monthlyEquivalent(2490, 365)).toBe(205)
  })

  it('kısa paketlerde aylık karşılık göstermez', () => {
    expect(monthlyEquivalent(199, 30)).toBeNull()
  })
})
