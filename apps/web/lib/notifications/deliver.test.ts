import { describe, expect, it, vi } from 'vitest'
import type { DataClient } from '@/lib/data/client'
import { deliverNotifications, deliverNotificationsQuietly } from './deliver'

/**
 * Bildirim kapısının sözleşmesi: uygulama içi bildirimi kapatmış kullanıcıya
 * SATIR YAZILMAZ. Faz 6'da beş ayrı yazıcı oluşmuştu ve üçü bu denetimi
 * atlıyordu; testler kapının kendisini değil, kapının atlanamadığını korur.
 */

type ProfileRow = { id: string; notification_prefs: unknown }

function fakeClient(profiles: ProfileRow[]) {
  const inserted: unknown[][] = []

  const client = {
    from(table: string) {
      if (table === 'profiles') {
        return {
          select() {
            return {
              in(_column: string, ids: string[]) {
                return Promise.resolve({
                  data: profiles.filter((row) => ids.includes(row.id)),
                  error: null,
                })
              },
            }
          },
        }
      }
      return {
        insert(rows: unknown[]) {
          inserted.push(rows)
          return Promise.resolve({ error: null })
        },
      }
    },
  } as unknown as DataClient

  return { client, inserted }
}

const draft = (userId: string) =>
  ({
    userId,
    type: 'badge_earned' as const,
    title: 'Yeni rozet kazandın',
    body: 'Video Kaşifi',
    link: '/rozetler',
  }) as const

describe('deliverNotifications', () => {
  it('tercihi kapalı kullanıcıya satır yazmaz', async () => {
    const { client, inserted } = fakeClient([
      { id: 'kapali', notification_prefs: { app_notifications: false } },
    ])

    const result = await deliverNotifications(client, [draft('kapali')])

    expect(result).toEqual({ inserted: 0, optedOut: 1 })
    expect(inserted).toHaveLength(0)
  })

  it('tercihi açık kullanıcıya yazar ve alan adlarını kolonlara çevirir', async () => {
    const { client, inserted } = fakeClient([
      { id: 'acik', notification_prefs: { app_notifications: true } },
    ])

    const result = await deliverNotifications(client, [draft('acik')])

    expect(result).toEqual({ inserted: 1, optedOut: 0 })
    expect(inserted[0]).toEqual([
      {
        user_id: 'acik',
        type: 'badge_earned',
        title: 'Yeni rozet kazandın',
        body: 'Video Kaşifi',
        link: '/rozetler',
      },
    ])
  })

  it('yalnızca açık olanları yazar, karışık partide', async () => {
    const { client, inserted } = fakeClient([
      { id: 'a', notification_prefs: { app_notifications: true } },
      { id: 'b', notification_prefs: { app_notifications: false } },
      { id: 'c', notification_prefs: {} },
    ])

    const result = await deliverNotifications(client, [draft('a'), draft('b'), draft('c')])

    expect(result).toEqual({ inserted: 2, optedOut: 1 })
    expect((inserted[0] as Array<{ user_id: string }>).map((row) => row.user_id)).toEqual([
      'a',
      'c',
    ])
  })

  it('profili okunamayan kullanıcı susturulmaz (varsayılan açık)', async () => {
    const { client, inserted } = fakeClient([])

    const result = await deliverNotifications(client, [draft('bilinmeyen')])

    expect(result).toEqual({ inserted: 1, optedOut: 0 })
    expect(inserted).toHaveLength(1)
  })

  it('boş listede veritabanına hiç gitmez', async () => {
    const { client, inserted } = fakeClient([])
    expect(await deliverNotifications(client, [])).toEqual({ inserted: 0, optedOut: 0 })
    expect(inserted).toHaveLength(0)
  })
})

describe('deliverNotificationsQuietly', () => {
  it('yazma hatasında fırlatmaz — tetikleyen işlem geri alınmaz', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const failing = {
      from() {
        return {
          select() {
            return {
              in() {
                return Promise.resolve({ data: null, error: { message: 'kopuk' } })
              },
            }
          },
        }
      },
    } as unknown as DataClient

    await expect(deliverNotificationsQuietly(failing, [draft('a')])).resolves.toEqual({
      inserted: 0,
      optedOut: 0,
    })

    spy.mockRestore()
  })
})
