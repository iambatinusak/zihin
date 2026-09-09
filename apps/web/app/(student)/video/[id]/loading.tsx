import { Skeleton } from '@zihin/ui/skeleton'

export default function VideoLoading() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-7 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
