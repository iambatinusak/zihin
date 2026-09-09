'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { cn } from '@zihin/ui/lib/utils'
import { startTest } from '@/app/(student)/test/actions'
import { section } from '@/lib/i18n/test'
import type { TestStrings } from './strings'

/**
 * Test oturumu açıp çözme ekranına götüren düğme.
 *
 * Neden düğme, neden `<Link href="/test/...">` değil: `/test/[sessionId]`
 * rotasındaki kimlik testin değil OTURUMUN kimliğidir ve oturum sunucuda
 * açılır. Yarım kalan bir oturum varsa `startTest` yenisini açmaz, onu döner —
 * yani bu düğme "devam et" işlevini de üstlenir.
 */

type StartTestButtonProps = {
  /** Var olan bir test ya da hızlı tekrar isteği. */
  input: { testId: string } | { type: 'quick_practice'; topicId?: string }
  children?: React.ReactNode
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
  className?: string
  /** Satır bağlantısı gibi görünen, kutusuz kullanım için. */
  asRow?: boolean
}

export function StartTestButton({
  input,
  children,
  variant = 'default',
  size = 'sm',
  className,
  asRow = false,
}: StartTestButtonProps) {
  const s = section<TestStrings>('test')
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function start() {
    if (pending) return
    setPending(true)
    try {
      const result = await startTest(input)
      if (result.ok) {
        router.push(`/test/${result.data.sessionId}`)
        // Yönlendirme tamamlanana kadar düğme kilitli kalır; kullanıcı ikinci
        // kez tıklayıp ikinci bir oturum açmaya çalışmasın.
        return
      }
      setPending(false)
      toast.error(result.error.message)
    } catch {
      setPending(false)
      toast.error(s.saveFailed)
    }
  }

  const label = children ?? s.solve

  if (asRow) {
    return (
      <button
        type="button"
        onClick={() => void start()}
        disabled={pending}
        aria-busy={pending}
        className={cn(
          'hover:bg-muted/60 focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70',
          className,
        )}
      >
        {label}
      </button>
    )
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
      {pending ? s.starting : label}
    </Button>
  )
}
