import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { Badge } from '@zihin/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zihin/ui/card'
import { cn } from '@zihin/ui/lib/utils'
import { fill, t } from '@/lib/i18n'
import { formatTry, monthlyEquivalent } from '@/lib/billing/money'
import type { BillingPackage } from '@/lib/data/billing'

type PackageCardProps = {
  pkg: BillingPackage
  /** Kullanıcının hedef sınavına uyan paket öne çıkarılır. */
  highlighted?: boolean
  /** Sınav adı; paketin kapsamını bir bakışta anlatır. */
  examName?: string | null
  /** "Paketi al" düğmesi ya da "Giriş yap" bağlantısı. */
  action: ReactNode
  footnote?: ReactNode
}

/** Fiyat sayfasındaki tek paket kartı. */
export function PackageCard({
  pkg,
  highlighted = false,
  examName,
  action,
  footnote,
}: PackageCardProps) {
  const monthly = monthlyEquivalent(pkg.priceTry, pkg.durationDays)
  const months = Math.round(pkg.durationDays / 30)

  return (
    <Card
      className={cn(
        'flex h-full flex-col',
        highlighted && 'border-primary ring-primary/30 shadow-sm ring-1',
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={highlighted ? 'default' : 'secondary'}>
            {examName ?? t('billing.allExams')}
          </Badge>
          {highlighted ? (
            <Badge variant="success" title={t('billing.recommendedHint')}>
              {t('billing.recommended')}
            </Badge>
          ) : null}
        </div>

        <CardTitle className="text-xl">{pkg.name}</CardTitle>
        {pkg.description ? <CardDescription>{pkg.description}</CardDescription> : null}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        <div>
          <p className="text-foreground text-3xl font-semibold tracking-tight">
            {formatTry(pkg.priceTry)}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {pkg.durationDays >= 60
              ? fill(t('billing.durationMonths'), { months })
              : fill(t('billing.durationDays'), { days: pkg.durationDays })}
            {monthly !== null
              ? ` · ${fill(t('billing.monthlyEquivalent'), { amount: formatTry(monthly) })}`
              : ''}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{t('billing.priceNote')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-foreground text-sm font-medium">{t('billing.featuresTitle')}</p>
          <ul className="space-y-2">
            <FeatureRow included label={t('billing.featureVideos')} />
            <FeatureRow included label={t('billing.featureTests')} />
            <FeatureRow included label={t('billing.featureCards')} />
            <FeatureRow
              included={pkg.features.mockExamAccess}
              label={
                pkg.features.mockExamAccess
                  ? t('billing.featureMockAccess')
                  : t('billing.featureNoMockAccess')
              }
            />
            <FeatureRow
              included={pkg.features.dailyQuestionLimit !== null}
              label={
                pkg.features.dailyQuestionLimit !== null
                  ? fill(t('billing.featureDailyQuestions'), {
                      count: pkg.features.dailyQuestionLimit,
                    })
                  : t('billing.featureNoDailyQuestions')
              }
            />
            <FeatureRow
              included={pkg.features.coaching}
              label={
                pkg.features.coaching
                  ? t('billing.featureCoaching')
                  : t('billing.featureNoCoaching')
              }
            />
          </ul>
        </div>

        <div className="mt-auto space-y-2">
          {action}
          {footnote}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Özellik satırı. Renk tek başına anlam taşımaz: dâhil olmayan özellik hem
 * farklı simge hem de olumsuz metinle yazılır (CONVENTIONS §8).
 */
function FeatureRow({ included, label }: { included: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {included ? (
        <Check aria-hidden="true" className="text-mastery-strong mt-0.5 size-4 shrink-0" />
      ) : (
        <X aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      )}
      <span className={included ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  )
}
