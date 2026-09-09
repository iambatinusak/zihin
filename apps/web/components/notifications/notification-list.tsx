'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@zihin/ui/button'
import { markAllRead } from '@/app/(student)/bildirimler/actions'
import { NotificationItem, type NotificationItemView } from './notification-item'
import type { NotificationStrings } from './strings'

/**
 * `/bildirimler` sayfasının liste gövdesi.
 *
 * Satırların kendisi sunucuda üretildi (zaman etiketleri dâhil); burada
 * yalnızca "tümünü okundu işaretle" ve tıklama davranışı yaşıyor. İşaretleme
 * sonrası `router.refresh()` çağrılır: sunucu yeniden render edilince zil
 * rozeti de düzelir.
 */
export function NotificationList({
  items,
  strings,
  hasUnread,
}: {
  items: NotificationItemView[]
  strings: NotificationStrings
  hasUnread: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onMarkAll() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await markAllRead().catch(() => null)
      if (!result?.ok) {
        setError(strings.markAllFailed)
        return
      }
      setMessage(strings.markAllDone)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-muted-foreground min-h-5 text-sm">
          {message}
        </p>
        <Button variant="outline" size="sm" onClick={onMarkAll} disabled={pending || !hasUnread}>
          {pending ? strings.markAllPending : strings.markAll}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <ul className="border-border divide-border divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationItem item={item} strings={strings} onRead={() => router.refresh()} />
          </li>
        ))}
      </ul>
    </div>
  )
}
