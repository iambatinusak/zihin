import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@zihin/ui/lib/utils'

export type Crumb = {
  label: string
  /** Son kırıntının bağlantısı olmaz. */
  href?: string
}

type PageHeaderProps = {
  title: string
  description?: string
  /** Sağ tarafta duran işlem düğmeleri. */
  actions?: ReactNode
  breadcrumb?: Crumb[]
  className?: string
}

/** Her sayfanın üst bloğu: başlık, açıklama, işlemler ve kırıntı yolu. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Kırıntı yolu">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-foreground">
                  {item.label}
                </span>
              )}
              {isLast ? null : <ChevronRight aria-hidden="true" className="size-3.5" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
