import { ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@zihin/ui/card'
import { SignOutButton } from '@/components/shell/sign-out-button'
import { getCurrentUser } from '@/lib/auth'
import { t } from '@/lib/i18n'

/**
 * Askıya alınmış hesabın gördüğü tek sayfa.
 *
 * `requireUser()` askıdaki kullanıcıyı buraya yollar; bu sayfa `requireUser`
 * ÇAĞIRMAZ — çağırsaydı kendi kendine yönlendirip döngüye girerdi. Oturumu
 * olmayan biri bu yola geldiğinde `middleware` zaten /login'e alır.
 */
export const metadata = { title: 'Hesap askıda' }
export const dynamic = 'force-dynamic'

export default async function SuspendedAccountPage() {
  const user = await getCurrentUser()

  return (
    <Card>
      <CardContent className="space-y-4 py-8 text-center">
        <ShieldAlert aria-hidden="true" className="text-destructive mx-auto size-10" />
        <h1 className="text-foreground text-xl font-semibold">{t('admin.suspendedTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('admin.suspendedBody')}</p>
        {user ? (
          <div className="pt-2">
            <SignOutButton />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
