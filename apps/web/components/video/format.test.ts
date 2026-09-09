import { describe, expect, it } from 'vitest'
import { PLAYBACK_RATES, formatClock, formatRate, formatSpokenTime } from './format'
import { fill } from '@/lib/i18n'

describe('formatClock', () => {
  it('bir saatin altında dakika:saniye yazar', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(9)).toBe('0:09')
    expect(formatClock(192)).toBe('3:12')
    expect(formatClock(3599)).toBe('59:59')
  })

  it('bir saatten uzun videoda saat basamağını ekler', () => {
    expect(formatClock(3600)).toBe('1:00:00')
    expect(formatClock(3723)).toBe('1:02:03')
  })

  it('geçersiz ve negatif değerleri sıfır sayar', () => {
    expect(formatClock(-5)).toBe('0:00')
    expect(formatClock(Number.NaN)).toBe('0:00')
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('0:00')
  })

  it('saniyenin kesirli kısmını aşağı yuvarlar', () => {
    expect(formatClock(192.9)).toBe('3:12')
  })
})

describe('formatSpokenTime', () => {
  it('dakika ve saniyeyi Türkçe okur', () => {
    expect(formatSpokenTime(192)).toBe('3 dakika 12 saniye')
  })

  it('sıfır saniyeyi yalnızca başka parça yoksa yazar', () => {
    expect(formatSpokenTime(60)).toBe('1 dakika')
    expect(formatSpokenTime(0)).toBe('0 saniye')
    expect(formatSpokenTime(-3)).toBe('0 saniye')
  })

  it('bir dakikanın altında yalnızca saniye yazar', () => {
    expect(formatSpokenTime(45)).toBe('45 saniye')
  })

  it('saat bileşenini ekler', () => {
    expect(formatSpokenTime(3723)).toBe('1 saat 2 dakika 3 saniye')
    expect(formatSpokenTime(3600)).toBe('1 saat')
  })
})

describe('formatRate', () => {
  it('ondalık ayırıcı olarak virgül kullanır', () => {
    expect(formatRate(0.75)).toBe('0,75')
    expect(formatRate(1.25)).toBe('1,25')
  })

  it('tam sayı hızda ondalık yazmaz', () => {
    expect(formatRate(1)).toBe('1')
    expect(formatRate(2)).toBe('2')
  })

  it('geçersiz hızda 1 döner', () => {
    expect(formatRate(0)).toBe('1')
    expect(formatRate(Number.NaN)).toBe('1')
  })
})

describe('PLAYBACK_RATES', () => {
  it('spec §M3 listesini artan sırada taşır', () => {
    expect([...PLAYBACK_RATES]).toEqual([0.75, 1, 1.25, 1.5, 1.75, 2])
  })
})

describe('fill', () => {
  it('yer tutucuyu doldurur', () => {
    expect(fill('{current} / {total}', { current: '3:12', total: '9:00' })).toBe('3:12 / 9:00')
  })

  it('karşılığı olmayan yer tutucuyu olduğu gibi bırakır', () => {
    expect(fill('{a} {b}', { a: 1 })).toBe('1 {b}')
  })
})
