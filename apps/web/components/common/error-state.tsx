'use client'

// "Tekrar dene" bir tıklama işleyicisi çağırır; bu yüzden istemci bileşenidir.
import { RotateCcw } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { cn } from '@zihin/ui/lib/utils'
import { t } from '@/lib/i18n/base'

type ErrorStateProps = {
  title?: string
  description?: string
  /** Verilmezse buton gösterilmez. */
  onRetry?: () => void
  className?: string
}

/** Beklenen ya da beklenmeyen hatalarda gösterilen ortak kutu. */
export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'border-destructive/40 bg-destructive/5 flex flex-col items-center justify-center rounded-lg border px-6 py-12 text-center',
        className,
      )}
    >
      <ErrorIllustration />
      <h3 className="text-foreground mt-4 text-base font-semibold">
        {title ?? t('states.errorTitle')}
      </h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {description ?? t('states.errorDescription')}
      </p>
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCcw aria-hidden="true" className="size-4" />
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  )
}

/** Özgün çizim: kırık bir çember ve ünlem. */
function ErrorIllustration() {
  return (
    <svg
      viewBox="0 0 48 48"
      role="presentation"
      aria-hidden="true"
      className="text-destructive h-14 w-14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M40 16 A18 18 0 1 1 32 8" opacity="0.6" />
      <path d="M24 16 L24 27" />
      <path d="M24 33 L24 33.5" />
    </svg>
  )
}
