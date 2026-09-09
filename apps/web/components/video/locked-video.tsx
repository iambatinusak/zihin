import Link from 'next/link'
import { Lock } from 'lucide-react'
import { buttonVariants } from '@zihin/ui/button'
import type { VideoStrings } from './strings'

/**
 * `getSignedVideoUrl` `subscription_required` döndüğünde gösterilen ödeme
 * duvarı. Hata ekranı değil, tasarlanmış bir durumdur: kullanıcı yanlış bir
 * şey yapmadı, yalnızca bu içerik abonelik istiyor.
 */
export function LockedVideo({ strings }: { strings: VideoStrings }) {
  return (
    <div className="border-border bg-card flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full"
      >
        <Lock className="size-6" />
      </span>
      <h2 className="text-foreground text-lg font-semibold">{strings.lockedTitle}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">{strings.lockedDescription}</p>
      <Link href="/paketler" className={buttonVariants({ className: 'mt-6' })}>
        {strings.lockedAction}
      </Link>
    </div>
  )
}

/**
 * Bağlantı üretilemediğinde (sağlayıcı hatası, süresi dolmuş kurulum)
 * gösterilen durum. Kilit değildir; sayfayı yenilemek çözebilir.
 */
export function UnavailableVideo({
  strings,
  message,
}: {
  strings: VideoStrings
  message?: string | null
}) {
  return (
    <div
      role="alert"
      className="border-border bg-card flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center"
    >
      <h2 className="text-foreground text-lg font-semibold">{strings.unavailableTitle}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        {message ?? strings.playerError}
      </p>
    </div>
  )
}
