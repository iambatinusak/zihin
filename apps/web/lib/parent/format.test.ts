import { describe, expect, it } from 'vitest'
import { splitHoursMinutes } from './format'

describe('splitHoursMinutes', () => {
  it('bir saatin altını olduğu gibi bırakır', () => {
    expect(splitHoursMinutes(45)).toEqual({ hours: 0, minutes: 45 })
  })

  it('saat ve dakikaya böler', () => {
    expect(splitHoursMinutes(135)).toEqual({ hours: 2, minutes: 15 })
  })

  it('tam saatte dakika sıfırdır', () => {
    expect(splitHoursMinutes(120)).toEqual({ hours: 2, minutes: 0 })
  })

  it('geçersiz ve negatif değeri sıfır sayar', () => {
    expect(splitHoursMinutes(0)).toEqual({ hours: 0, minutes: 0 })
    expect(splitHoursMinutes(-30)).toEqual({ hours: 0, minutes: 0 })
    expect(splitHoursMinutes(Number.NaN)).toEqual({ hours: 0, minutes: 0 })
  })
})
