import { Skeleton } from '@zihin/ui/skeleton'
import { cn } from '@zihin/ui/lib/utils'

/**
 * `loading.tsx` dosyalarında ve Suspense sınırlarında kullanılan iskelet
 * şekilleri. Ekran okuyucular için gizlenir; yüklenme durumu metinle değil,
 * sayfanın kendi `aria-busy` davranışıyla bildirilir.
 */

function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
}

/** Kart ızgarası (ders listesi, rozetler, deneme kartları). */
export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {range(count).map((index) => (
        <div key={index} className="border-border space-y-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-9 w-28" />
        </div>
      ))}
    </div>
  )
}

/** Dikey liste (konular, bildirimler, hafıza kartları). */
export function ListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <ul aria-hidden="true" className={cn('space-y-3', className)}>
      {range(count).map((index) => (
        <li key={index} className="border-border flex items-center gap-3 rounded-md border p-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Tablo (yönetim ekranları, deneme sonuçları). */
export function TableSkeleton({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div aria-hidden="true" className={cn('border-border rounded-lg border', className)}>
      <div className="border-border bg-muted/40 flex gap-4 border-b p-3">
        {range(columns).map((index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      {range(rows).map((row) => (
        <div key={row} className="border-border flex gap-4 border-b p-3 last:border-b-0">
          {range(columns).map((column) => (
            <Skeleton key={column} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Sayfa başlığı + gövde için kaba bir yerleşim iskeleti. */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <CardGridSkeleton />
    </div>
  )
}
