'use client'

import * as React from 'react'
import { Timer } from 'lucide-react'
import { cn } from '@zihin/ui/lib/utils'
import { formatCountdown, secondsUntil } from '@/lib/mock/countdown'
import { section } from '@/lib/i18n/mock'
import type { MockStrings } from './strings'

/**
 * Canlı deneme geri sayımı (spec §M10).
 *
 * Kalan süre her tikte `hedef - şimdi` farkından YENİDEN hesaplanır; azalan bir
 * sayaç tutulmaz. Sekme uyutulduğunda ya da sayfa yenilendiğinde değer doğru
 * kalır.
 *
 * Sıfıra indiğinde sayfa KENDİLİĞİNDEN yenilenmez: pencere açıldığında düğmenin
 * belirmesi sunucudan gelen bir karardır ve kullanıcı sayfayı yenilediğinde
 * görür. Sayaç yalnızca bilgi verir, yetki vermez — yetkiyi `startMock` verir.
 */
const s = section<MockStrings>('mock')

const UNITS = {
  day: s.countdownDay,
  hour: s.countdownHour,
  minute: s.countdownMinute,
  second: s.countdownSecond,
}

export function MockCountdown({
  target,
  label,
  className,
}: {
  /** ISO damgası; okunamıyorsa hiçbir şey basılmaz. */
  target: string
  label: string
  className?: string
}) {
  const [remaining, setRemaining] = React.useState<number | null>(() =>
    secondsUntil(target, Date.now()),
  )

  React.useEffect(() => {
    const tick = () => setRemaining(secondsUntil(target, Date.now()))
    tick()
    const timer = window.setInterval(tick, 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [target])

  if (remaining === null) return null

  return (
    <p
      className={cn('text-muted-foreground flex items-center gap-1.5 text-xs', className)}
      // Her saniye değişen bir metin ekran okuyucuya sürekli okutulmaz.
      aria-live="off"
    >
      <Timer aria-hidden="true" className="size-3.5" />
      <span>{label}</span>
      <span className="text-foreground font-semibold tabular-nums">
        {remaining === 0 ? s.countdownStarted : formatCountdown(remaining, UNITS)}
      </span>
    </p>
  )
}
