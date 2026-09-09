'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@zihin/ui/popover'
import { Separator } from '@zihin/ui/separator'
import { t } from '@/lib/i18n/base'
import { fetchRecentNotifications, markAllRead } from '@/app/(student)/bildirimler/actions'
import { formatRelativeTime, relativeTime } from '@/lib/notifications/format'
import { FALLBACK_NOTIFICATION_TYPE, isNotificationType } from '@/lib/notifications/types'
import { NotificationItem, type NotificationItemView } from './notification-item'
import { notificationStrings } from './strings'

/**
 * Üst çubuktaki bildirim zili (spec §M16).
 *
 * ── LİSTE AÇILINCA ÇEKİLİR ─────────────────────────────────────────────────
 * Düzen yalnızca okunmamış SAYIYI sunucuda okur (çok küçük kısmi indeks,
 * 0007_support.sql). Listenin kendisi zil açıldığında bir Server Action ile
 * gelir; böylece her sayfa gezinmesi fazladan bir sorgu ödemez.
 *
 * ── SAYAÇ İYİMSER GÜNCELLENİR ──────────────────────────────────────────────
 * Sunucudan gelen ilk sayı `initialUnreadCount`tur; kullanıcı okudukça yerel
 * durum düşer. Popover her açılışta gerçek sayıyı yeniden okuyup düzeltir, bu
 * yüzden iyimser sapma bir açılıştan uzun yaşamaz.
 */
export type NotificationBellProps = {
  initialUnreadCount: number
  /**
   * Tam liste sayfasının yolu. `/bildirimler` sayfası `(student)` rota
   * grubunda yaşıyor ve o grubun düzeni öğrenci zorunlu kılıyor; veli,
   * öğretmen ve yönetici için bağlantı GÖSTERİLMEZ (null) — kırık bir
   * bağlantı sunmaktansa hiç sunmamak yeğdir. Bu roller bildirimlerini bu
   * panelden okur.
   */
  fullPageHref?: string | null
}

export function NotificationBell({
  initialUnreadCount,
  fullPageHref = null,
}: NotificationBellProps) {
  const s = notificationStrings()
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [items, setItems] = useState<NotificationItemView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [markingAll, startMarkAll] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchRecentNotifications({ limit: 8 })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      const now = new Date()
      setItems(
        result.data.items.map((item) => ({
          id: item.id,
          type: isNotificationType(item.type) ? item.type : FALLBACK_NOTIFICATION_TYPE,
          title: item.title,
          body: item.body,
          link: item.link,
          read: item.read_at !== null,
          timeLabel: formatRelativeTime(relativeTime(item.created_at, now), s.time),
        })),
      )
      setUnreadCount(result.data.unreadCount)
    } catch {
      setError(s.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [s.loadFailed, s.time])

  function onOpenChange(open: boolean) {
    if (open) void load()
  }

  function onMarkAll() {
    startMarkAll(async () => {
      const result = await markAllRead().catch(() => null)
      if (!result?.ok) {
        setError(s.markAllFailed)
        return
      }
      setUnreadCount(0)
      setItems((current) => current?.map((item) => ({ ...item, read: true })) ?? null)
    })
  }

  const hasUnread = unreadCount > 0
  const label = hasUnread
    ? `${t('shell.notifications')} — ${unreadCount} ${t('shell.unreadCount')}`
    : `${t('shell.notifications')} — ${t('shell.noNotifications')}`

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={label}>
          <Bell aria-hidden="true" className="size-5" />
          {hasUnread ? (
            <span
              aria-hidden="true"
              className="bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="text-foreground text-sm font-semibold">{s.panelTitle}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onMarkAll}
            disabled={markingAll || !hasUnread}
          >
            {markingAll ? s.markAllPending : s.markAll}
          </Button>
        </div>

        <Separator />

        <div className="max-h-80 overflow-y-auto p-1">
          {loading && items === null ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">{s.loading}</p>
          ) : error ? (
            <p role="alert" className="text-destructive px-3 py-6 text-center text-sm">
              {error}
            </p>
          ) : items && items.length > 0 ? (
            items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                strings={s}
                compact
                onRead={() => setUnreadCount((count) => Math.max(0, count - 1))}
              />
            ))
          ) : (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">{s.emptyBody}</p>
          )}
        </div>

        {fullPageHref ? (
          <>
            <Separator />
            <div className="px-3 py-2">
              <Link
                href={fullPageHref}
                className="text-primary text-sm font-medium underline-offset-4 hover:underline"
              >
                {s.viewAll}
              </Link>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
