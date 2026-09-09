import { Skeleton } from '@zihin/ui/skeleton'
import { ListSkeleton } from '@/components/common/loading-skeleton'

export default function SubjectLoading() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-56" />
      </div>
      <ListSkeleton count={6} />
    </div>
  )
}
