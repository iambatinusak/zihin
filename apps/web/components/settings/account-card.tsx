import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Separator } from '@zihin/ui/separator'
import { section } from '@/lib/i18n'

const s = section<{ account: Record<string, string> }>('settings')

/**
 * KVKK taleplerinin gittiği adres. Ortam değişkeni değil: adres sözleşmede ve
 * aydınlatma metninde de aynı geçiyor, dağıtıma göre değişmiyor.
 */
const SUPPORT_EMAIL = 'kvkk@zihin.com.tr'

/**
 * Hesap bölümü: şifre değişikliği sıfırlama akışına devreder, KVKK silme
 * talebi ise şimdilik e-posta ile alınır.
 *
 * Talebi YÜRÜTEN taraf yazıldı (`admin/kullanicilar` → `anonymizeUser`), ama
 * başlatan taraf bilerek e-posta olarak kaldı: KVKK talebi kimlik doğrulaması
 * ister ve öğrencinin tek tıkla kendi hesabını geri dönüşsüz anonimleştirmesi
 * (kazı sonuçları ve ödeme geçmişi dahil) yanlışlıkla tetiklenebilecek kadar
 * ağır bir işlem. Talep e-postayla gelir, yönetici panelden uygular.
 */
export function AccountCard({ email }: { email: string }) {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('KVKK veri silme talebi')}`

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-xs">{s.account.email}</p>
        <p className="mt-1 text-sm font-medium">{email}</p>
      </div>

      <div className="space-y-2">
        <Button asChild variant="outline">
          <Link href="/forgot-password">{s.account.changePassword}</Link>
        </Button>
        <p className="text-muted-foreground text-xs">{s.account.changePasswordHint}</p>
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">{s.account.kvkkTitle}</h3>
        <p className="text-muted-foreground text-sm">{s.account.kvkkBody}</p>
        <Button asChild variant="outline">
          <a href={mailto}>
            <Mail aria-hidden="true" className="size-4" />
            {s.account.kvkkContact}
          </a>
        </Button>
        <p className="text-muted-foreground text-xs">{s.account.kvkkNote}</p>
      </div>
    </div>
  )
}
