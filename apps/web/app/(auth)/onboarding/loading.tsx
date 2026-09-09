import { Card, CardContent } from '@zihin/ui/card'
import { Skeleton } from '@zihin/ui/skeleton'
import { t } from '@/lib/i18n/base'

/** Sihirbaz sunucudan yüklenirken gösterilen iskelet. */
export default function OnboardingLoading() {
  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <span className="sr-only">{t('common.loading')}</span>
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-28" />
      </CardContent>
    </Card>
  )
}
