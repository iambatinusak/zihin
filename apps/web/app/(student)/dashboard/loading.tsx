import { Skeleton } from '@zihin/ui/skeleton'

/** Panelin iskelet hâli — kutu yerleşimi sayfanın kendisiyle aynı. */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Skeleton className="h-32 w-full" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 w-full lg:col-span-2" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 w-full lg:col-span-2" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
