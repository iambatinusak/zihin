import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@zihin/ui/card'
import { cn } from '@zihin/ui/lib/utils'

/**
 * Panelin ortak kutu iskeleti.
 *
 * Bütün kutular aynı yükseklik ritmini ve aynı "başlık · içerik · bağlantı"
 * düzenini paylaşsın diye tek yerde tanımlıdır; kutular arasında farklılaşan
 * tek şey içerik olmalı.
 */
type PanelCardProps = {
  title: string
  icon?: ReactNode
  children: ReactNode
  /** Kutunun altındaki tek eylem bağlantısı. */
  link?: { href: string; label: string }
  className?: string
}

export function PanelCard({ title, icon, children, link, className }: PanelCardProps) {
  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-2">{children}</div>

        {link ? (
          <Link
            href={link.href}
            className="text-primary hover:text-primary/80 focus-visible:ring-ring inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            {link.label}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Kutunun içindeki büyük sayı ve birimi. */
export function BigNumber({ value, unit }: { value: string | number; unit?: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-foreground text-3xl font-semibold tabular-nums">{value}</span>
      {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
    </p>
  )
}

/** Kutu içi "veri yok" metni — tam bir EmptyState'in ağırlığı olmadan. */
export function PanelHint({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}
