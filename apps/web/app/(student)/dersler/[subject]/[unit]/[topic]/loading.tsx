import { Skeleton } from '@zihin/ui/skeleton'
import { ListSkeleton } from '@/components/common/loading-skeleton'

export default function TopicLoading() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-7 w-72" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
      <ListSkeleton count={4} />
    </div>
  )
}
