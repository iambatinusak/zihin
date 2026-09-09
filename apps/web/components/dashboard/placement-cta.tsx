import Link from 'next/link'
import { Compass } from 'lucide-react'
import { buttonVariants } from '@zihin/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { StartPlacementButton } from '@/components/placement/start-placement-button'
import { placementStrings } from '@/components/placement/strings'
import { dashboardStrings } from './strings'

/**
 * Panelin en üstündeki yönlendirme kutusu.
 *
 * Yeni bir öğrenci için panelin bütün kutuları boştur; ilk ekranın işi bir
 * boşluk göstermek değil, ilk adımı önermektir. Seviye tespiti tamamlanmışsa
 * bu kutu HİÇ basılmaz (çağıran tarafta denetlenir).
 */
export function PlacementCta({
  resumable,
  brandNew,
}: {
  /** Yarım kalmış bir oturum var mı? Düğme "devam et" olur. */
  resumable: boolean
  /** Hiç aktivitesi olmayan öğrenci: hoş geldin metni gösterilir. */
  brandNew: boolean
}) {
  const p = placementStrings()
  const d = dashboardStrings()

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Compass aria-hidden="true" className="text-primary size-4" />
          {brandNew ? d.welcomeTitle : p.title}
        </CardTitle>
        <CardDescription>{brandNew ? d.welcomeBody : p.intro}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <StartPlacementButton>{resumable ? p.resume : p.start}</StartPlacementButton>
        <Link href="/dersler" className={buttonVariants({ variant: 'ghost' })}>
          {brandNew ? d.welcomeSecondary : p.skip}
        </Link>
      </CardContent>
    </Card>
  )
}
