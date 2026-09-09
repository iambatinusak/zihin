'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@zihin/ui/lib/utils'
import { markRead } from '@/app/(student)/bildirimler/actions'
import type { NotificationType } from '@/lib/notifications/types'
import { NotificationIcon } from './icons'
import type { NotificationStrings } from './strings'

export type NotificationItemView = {
  id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read: boolean
  /** Sunucuda ya da veriyi çeken tarafta hesaplanmış "2 saat önce" etiketi. */
  timeLabel: string
}

type Props = {
  item: NotificationItemView
  strings: NotificationStrings
  /** Okundu işaretlendikten sonra çağrılır (zil rozetini tazelemek için). */
  onRead?: (id: string) => void
  /** Popover içinde daha sıkı bir düzen kullanılır. */
  compact?: boolean
}

/**
 * Tek bildirim satırı.
 *
 * TIKLAMA ÖNCE İŞARETLER, SONRA GİDER. İşaretleme başarısız olsa bile gezinme
 * yapılır: kullanıcının okumak istediği içeriğe ulaşması, sayacın doğruluğundan
 * önce gelir. Bağlantısı olmayan bildirim yalnızca işaretlenir.
 *
 * Öğe bir `<button>`dır, `<a>` değil: asıl eylem bir mutasyon (okundu
 * işaretleme) ve ardından programatik gezinmedir. Bağlantı görünümü verilseydi
 * "yeni sekmede aç" sessizce işaretlemeyi atlardı.
 */
export function NotificationItem({ item, strings, onRead, compact = false }: Props) {
  const router = useRouter()
  const [read, setRead] = useState(item.read)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (pending) return

    startTransition(async () => {
      if (!read) {
        setRead(true)
        const result = await markRead({ notificationId: item.id }).catch(() => null)
        if (result?.ok) {
          onRead?.(item.id)
        } else {
          // İşaretleme tutmadıysa görsel durum geri alınır; gezinme yine yapılır.
          setRead(false)
        }
      }
      if (item.link) router.push(item.link)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-busy={pending}
      className={cn(
        'hover:bg-muted/60 focus-visible:ring-ring flex w-full items-start gap-3 rounded-md px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
        compact ? 'py-2.5' : 'py-3',
        read ? 'opacity-80' : 'bg-primary/5',
      )}
    >
      <NotificationIcon type={item.type} />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-foreground min-w-0 flex-1 truncate text-sm',
              read ? 'font-medium' : 'font-semibold',
            )}
          >
            {item.title}
          </span>
          {read ? null : (
            <span className="bg-primary size-2 shrink-0 rounded-full" aria-hidden="true" />
          )}
        </span>

        {item.body ? (
          <span
            className={cn(
              'text-muted-foreground mt-0.5 block text-sm',
              compact ? 'line-clamp-2' : '',
            )}
          >
            {item.body}
          </span>
        ) : null}

        <span className="text-muted-foreground mt-1 block text-xs">
          {strings.types[item.type] ?? item.type} · {item.timeLabel}
          {read ? '' : ` · ${strings.unreadBadge}`}
        </span>
      </span>
    </button>
  )
}
