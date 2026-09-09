import { describe, expect, it } from 'vitest'
import type { DataClient } from '@/lib/data/client'
import {
  allowsChannel,
  allowsChannelFor,
  DEFAULT_NOTIFICATION_PREFS,
  filterByChannel,
  NOTIFICATION_CHANNELS,
  readNotificationPrefs,
  type NotificationPrefs,
} from './prefs'

/** `profiles` okumasını taklit eden en küçük istemci. */
function fakeClient(
  rows: Array<{ id: string; notification_prefs: unknown }>,
  error: { message: string } | null = null,
): DataClient {
  return {
    from() {
      return {
        select() {
          return {
            in(_column: string, ids: string[]) {
              return Promise.resolve({
                data: error ? null : rows.filter((row) => ids.includes(row.id)),
                error,
              })
            },
          }
        },
      }
    },
  } as unknown as DataClient
}

describe('allowsChannel', () => {
  it('her kanalı bağımsız değerlendirir', () => {
    const prefs = {
      email_reminders: false,
      email_weekly_summary: true,
      app_notifications: false,
    }

    expect(allowsChannel(prefs, 'email_reminders')).toBe(false)
    expect(allowsChannel(prefs, 'email_weekly_summary')).toBe(true)
    expect(allowsChannel(prefs, 'app_notifications')).toBe(false)
  })

  it('yalnızca açıkça false olan kanal kapanır', () => {
    for (const channel of NOTIFICATION_CHANNELS) {
      expect(allowsChannel({ [channel]: false }, channel)).toBe(false)
      expect(allowsChannel({ [channel]: true }, channel)).toBe(true)
    }
  })

  it('eksik anahtar varsayılana (açık) düşer', () => {
    expect(allowsChannel({ email_reminders: false }, 'app_notifications')).toBe(true)
    expect(allowsChannel({}, 'email_weekly_summary')).toBe(true)
  })

  it('bozuk jsonb değerleri kullanıcıyı susturmaz', () => {
    for (const value of [null, undefined, 'evet', 42, [], { app_notifications: 'hayır' }]) {
      expect(allowsChannel(value, 'app_notifications')).toBe(
        DEFAULT_NOTIFICATION_PREFS.app_notifications,
      )
    }
  })
})

describe('allowsChannelFor', () => {
  const map = new Map<string, NotificationPrefs>([
    ['kapali', { ...DEFAULT_NOTIFICATION_PREFS, email_reminders: false }],
  ])

  it('haritadaki tercihi kullanır', () => {
    expect(allowsChannelFor(map, 'kapali', 'email_reminders')).toBe(false)
    expect(allowsChannelFor(map, 'kapali', 'app_notifications')).toBe(true)
  })

  it('haritada olmayan kullanıcı varsayılana düşer', () => {
    expect(allowsChannelFor(map, 'bilinmeyen', 'email_reminders')).toBe(true)
  })
})

describe('readNotificationPrefs', () => {
  it('boş liste için sorgu yapmaz', async () => {
    const result = await readNotificationPrefs(fakeClient([]), [])
    expect(result.size).toBe(0)
  })

  it('okuma hatasını yutmaz', async () => {
    await expect(
      readNotificationPrefs(fakeClient([], { message: 'kopuk' }), ['a']),
    ).rejects.toThrow(/kopuk/)
  })
})

describe('filterByChannel', () => {
  const rows = [
    { id: 'a', notification_prefs: { email_reminders: true, app_notifications: false } },
    { id: 'b', notification_prefs: { email_reminders: false, app_notifications: true } },
    { id: 'c', notification_prefs: {} },
  ]

  it('e-posta kanalını kapatanı eler', async () => {
    const allowed = await filterByChannel(fakeClient(rows), ['a', 'b', 'c'], 'email_reminders')
    expect(allowed).toEqual(['a', 'c'])
  })

  it('uygulama içi kanalı ayrı değerlendirir', async () => {
    const allowed = await filterByChannel(fakeClient(rows), ['a', 'b', 'c'], 'app_notifications')
    expect(allowed).toEqual(['b', 'c'])
  })

  it('profili okunamayan kullanıcı sessizce susturulmaz', async () => {
    const allowed = await filterByChannel(fakeClient(rows), ['a', 'yok'], 'email_reminders')
    expect(allowed).toContain('yok')
  })
})
