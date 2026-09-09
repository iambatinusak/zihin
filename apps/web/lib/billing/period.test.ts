import { describe, expect, it } from 'vitest'
import {
  daysUntil,
  endsWithinDays,
  extendedPeriod,
  subscriptionPeriod,
  warningWindow,
  SUBSCRIPTION_WARNING_DAYS,
} from './period'

const NOW = new Date('2026-03-10T09:00:00.000Z')

describe('subscriptionPeriod', () => {
  it('bitişi süre kadar ileri alır', () => {
    const period = subscriptionPeriod(NOW, 365)
    expect(period.startsAt).toBe('2026-03-10T09:00:00.000Z')
    expect(period.endsAt).toBe('2027-03-10T09:00:00.000Z')
  })

  it('sıfır ya da negatif süreyi bir güne yuvarlar', () => {
    // `subscriptions_period_check` kısıtı ends_at > starts_at ister.
    expect(new Date(subscriptionPeriod(NOW, 0).endsAt).getTime()).toBeGreaterThan(NOW.getTime())
    expect(new Date(subscriptionPeriod(NOW, -30).endsAt).getTime()).toBeGreaterThan(NOW.getTime())
  })
})

describe('extendedPeriod', () => {
  it('süren abonelik varsa bitişin üstüne ekler', () => {
    const period = extendedPeriod('2026-04-10T09:00:00.000Z', 180, NOW)
    expect(period.startsAt).toBe('2026-04-10T09:00:00.000Z')
    expect(period.endsAt).toBe('2026-10-07T09:00:00.000Z')
  })

  it('bitmiş abonelik üstüne eklenmez, şimdiden başlar', () => {
    const period = extendedPeriod('2026-01-01T00:00:00.000Z', 30, NOW)
    expect(period.startsAt).toBe(NOW.toISOString())
  })

  it('abonelik yoksa şimdiden başlar', () => {
    expect(extendedPeriod(null, 30, NOW).startsAt).toBe(NOW.toISOString())
  })

  it('bozuk tarih şimdiden başlatır', () => {
    expect(extendedPeriod('cok-yakinda', 30, NOW).startsAt).toBe(NOW.toISOString())
  })
})

describe('endsWithinDays — 7 günlük uyarı penceresi', () => {
  const within = (iso: string) => endsWithinDays(iso, NOW, SUBSCRIPTION_WARNING_DAYS)

  it('altı gün sonra bitiyorsa uyarılır', () => {
    expect(within('2026-03-16T09:00:00.000Z')).toBe(true)
  })

  it('tam yedi gün sonra bitiyorsa uyarılır (üst sınır dâhil)', () => {
    expect(within('2026-03-17T09:00:00.000Z')).toBe(true)
  })

  it('yedi günden bir saniye sonra bitiyorsa uyarılmaz', () => {
    expect(within('2026-03-17T09:00:01.000Z')).toBe(false)
  })

  it('zaten bitmiş abonelik uyarılmaz — o `expired` işaretlenir', () => {
    expect(within('2026-03-09T09:00:00.000Z')).toBe(false)
  })

  it('tam şu an biten abonelik uyarılmaz (alt sınır hariç)', () => {
    expect(within(NOW.toISOString())).toBe(false)
  })

  it('bozuk tarih uyarı üretmez', () => {
    expect(within('bir ara')).toBe(false)
  })
})

describe('warningWindow', () => {
  it('sorgu sınırlarını şimdi ve şimdi + 7 gün olarak verir', () => {
    expect(warningWindow(NOW)).toEqual({
      fromIso: '2026-03-10T09:00:00.000Z',
      toIso: '2026-03-17T09:00:00.000Z',
    })
  })
})

describe('daysUntil', () => {
  it('bugün bitiyorsa 0 döner', () => {
    expect(daysUntil('2026-03-10T23:00:00.000Z', NOW)).toBe(0)
  })

  it('tam günü aşağı yuvarlar', () => {
    expect(daysUntil('2026-03-13T08:00:00.000Z', NOW)).toBe(2)
  })

  it('geçmiş tarih negatiftir', () => {
    expect(daysUntil('2026-03-08T09:00:00.000Z', NOW)).toBe(-2)
  })
})
