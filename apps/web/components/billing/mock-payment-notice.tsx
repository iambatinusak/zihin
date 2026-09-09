import { AlertTriangle } from 'lucide-react'
import { t } from '@/lib/i18n'

/**
 * "Bu bir test ödemesidir" bandı.
 *
 * Sahte sağlayıcı devredeyken (kimlik bilgisi tanımlı değil) ödemeye dokunan
 * HER ekranda gösterilir. Sahte bir tahsilatın gerçek gibi görünmesi, ödeme
 * akışında yapılabilecek en pahalı hatadır; bu bileşen o hatanın önündeki tek
 * engeldir, koşula bağlanmaz.
 */
export function MockPaymentNotice() {
  return (
    <div
      role="status"
      className="border-mastery-medium/50 bg-mastery-medium/10 flex items-start gap-3 rounded-lg border p-4"
    >
      <AlertTriangle aria-hidden="true" className="text-mastery-medium mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">{t('billing.mockNoticeTitle')}</p>
        <p className="text-muted-foreground text-sm">{t('billing.mockNoticeBody')}</p>
      </div>
    </div>
  )
}
