import type { ReactNode } from 'react'
import { cn } from '@zihin/ui/lib/utils'

type EmptyStateProps = {
  /** İkon ya da illüstrasyon yuvası. Verilmezse özgün varsayılan çizim kullanılır. */
  icon?: ReactNode
  title: string
  description?: string
  /** Genelde bir <Button> ya da <Link>. */
  action?: ReactNode
  className?: string
}

/** Liste, ızgara ve panellerde "içerik yok" durumu. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <div className="text-muted-foreground mb-4">{icon ?? <EmptyIllustration />}</div>
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      {description ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

/** Özgün, basit çizim: boş bir kutu ve içindeki tek satır. Dış varlık kullanılmaz. */
function EmptyIllustration() {
  return (
    <svg
      viewBox="0 0 64 48"
      role="presentation"
      aria-hidden="true"
      className="h-16 w-20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 18 L32 6 L56 18 L56 40 A2 2 0 0 1 54 42 L10 42 A2 2 0 0 1 8 40 Z" opacity="0.5" />
      <path d="M8 18 L32 30 L56 18" opacity="0.5" />
      <path d="M24 36 L40 36" opacity="0.9" />
    </svg>
  )
}
