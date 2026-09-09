import { describe, expect, it } from 'vitest'
import { formatRelativeTime, relativeTime, type RelativeTimeStrings } from './format'

const NOW = new Date('2026-09-09T12:00:00+03:00')

const STRINGS: RelativeTimeStrings = {
  now: 'az önce',
  minutes: '{n} dakika önce',
  hours: '{n} saat önce',
  days: '{n} gün önce',
}

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString()
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('relativeTime', () => {
  it('bir dakikadan yeni ise "az önce"', () => {
    expect(relativeTime(ago(0), NOW)).toEqual({ kind: 'now' })
    expect(relativeTime(ago(59_000), NOW)).toEqual({ kind: 'now' })
  })

  it('dakika, saat ve gün eşiklerini aşağı yuvarlar', () => {
    expect(relativeTime(ago(MINUTE), NOW)).toEqual({ kind: 'minute', value: 1 })
    expect(relativeTime(ago(59 * MINUTE + 59_000), NOW)).toEqual({ kind: 'minute', value: 59 })
    expect(relativeTime(ago(2 * HOUR), NOW)).toEqual({ kind: 'hour', value: 2 })
    expect(relativeTime(ago(23 * HOUR + 59 * MINUTE), NOW)).toEqual({ kind: 'hour', value: 23 })
    expect(relativeTime(ago(DAY), NOW)).toEqual({ kind: 'day', value: 1 })
    expect(relativeTime(ago(7 * DAY), NOW)).toEqual({ kind: 'day', value: 7 })
  })

  it('yedi günden eskisi tarih olarak yazılır', () => {
    const value = relativeTime(ago(8 * DAY), NOW)
    expect(value.kind).toBe('date')
  })

  it('gelecekteki zaman damgası negatif sayı üretmez', () => {
    expect(relativeTime(new Date(NOW.getTime() + 5 * HOUR).toISOString(), NOW)).toEqual({
      kind: 'now',
    })
  })

  it('geçersiz tarih çökertmez', () => {
    expect(relativeTime('bozuk', NOW).kind).toBe('date')
  })
})

describe('formatRelativeTime', () => {
  it('Türkçe etiketleri sözlükten üretir', () => {
    expect(formatRelativeTime(relativeTime(ago(30_000), NOW), STRINGS)).toBe('az önce')
    expect(formatRelativeTime(relativeTime(ago(5 * MINUTE), NOW), STRINGS)).toBe('5 dakika önce')
    expect(formatRelativeTime(relativeTime(ago(2 * HOUR), NOW), STRINGS)).toBe('2 saat önce')
    expect(formatRelativeTime(relativeTime(ago(3 * DAY), NOW), STRINGS)).toBe('3 gün önce')
  })

  it('eski kayıtta Türkçe tarih biçimi kullanılır', () => {
    const label = formatRelativeTime(relativeTime(ago(30 * DAY), NOW), STRINGS)
    expect(label).toMatch(/Ağustos|Temmuz/)
    expect(label).toContain('2026')
  })

  it('yer tutucu doldurulmadan kalmaz', () => {
    for (const ms of [30_000, 5 * MINUTE, 2 * HOUR, 3 * DAY, 30 * DAY]) {
      expect(formatRelativeTime(relativeTime(ago(ms), NOW), STRINGS)).not.toContain('{n}')
    }
  })
})
