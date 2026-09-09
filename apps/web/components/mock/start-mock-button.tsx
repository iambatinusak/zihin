'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { startMock } from '@/app/(student)/deneme/actions'
import { section } from '@/lib/i18n/mock'
import type { MockStrings } from './strings'

/**
 * Deneme oturumu açıp çözme ekranına götüren düğme.
 *
 * Neden düğme, neden `<Link>` değil: `/deneme/[sessionId]` rotasındaki kimlik
 * denemenin değil OTURUMUN kimliğidir ve oturum sunucuda açılır. Yarım kalan
 * bir oturum varsa `startMock` yenisini açmaz, onu döner — yani bu düğme
 * "devam et" işlevini de üstlenir.
 *
 * Düğmenin GÖRÜNMESİ bir yetki değildir: canlı pencere denetimi `startMock` ve
 * `startTest` içinde, sunucuda yapılır.
 */
export function StartMockButton({
  testId,
  children,
  variant = 'default',
  className,
}: {
  testId: string
  children?: React.ReactNode
  variant?: React.ComponentProps<typeof Button>['variant']
  className?: string
}) {
  const s = section<MockStrings>('mock')
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function start() {
    if (pending) return
    setPending(true)
    try {
      const result = await startMock({ testId })
      if (result.ok) {
        router.push(`/deneme/${result.data.sessionId}`)
        // Yönlendirme tamamlanana kadar kilitli kalır; ikinci tıklama ikinci
        // bir oturum açmaya çalışmasın.
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
      size="sm"
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
