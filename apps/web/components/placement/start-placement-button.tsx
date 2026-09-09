'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { startPlacementTest } from '@/app/(student)/seviye-tespit/actions'
import { placementStrings } from './strings'

/**
 * Seviye tespit oturumunu açıp test motoruna götüren düğme.
 *
 * `<Link>` değil düğme: `/test/[sessionId]` yolundaki kimlik SUNUCUDA açılan
 * oturuma aittir. Yarım kalan bir oturum varsa action yenisini açmaz, onu
 * döner — bu düğme aynı zamanda "devam et" işlevini görür.
 */
type StartPlacementButtonProps = {
  children?: React.ReactNode
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
  className?: string
}

export function StartPlacementButton({
  children,
  variant = 'default',
  size = 'default',
  className,
}: StartPlacementButtonProps) {
  const s = placementStrings()
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function start() {
    if (pending) return
    setPending(true)
    try {
      const result = await startPlacementTest()
      if (result.ok) {
        if (result.data.short) toast.warning(s.shortWarning)
        router.push(`/test/${result.data.sessionId}`)
        // Yönlendirme bitene kadar kilitli kalır: ikinci tıklama ikinci bir
        // sınav satırı açmasın.
        return
      }
      setPending(false)
      toast.error(result.error.message)
    } catch {
      setPending(false)
      toast.error(s.startFailed)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() => void start()}
    >
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {pending ? s.starting : (children ?? s.start)}
    </Button>
  )
}
