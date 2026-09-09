'use client'

// Çıkış sırasında butonu kilitlemek ve hata mesajı göstermek için durum gerekiyor.
import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@zihin/ui/lib/utils'
import { signOut } from '@/app/(auth)/actions'
import { t } from '@/lib/i18n/auth'

type SignOutButtonProps = {
  className?: string
}

export function SignOutButton({ className }: SignOutButtonProps) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await signOut()
          // Başarılı akışta redirect() devreye girer ve buraya hiç gelinmez.
          if (!result.ok) toast.error(result.error.message)
        })
      }
      className={cn(
        'flex w-full items-center gap-2 text-left text-sm disabled:opacity-60',
        className,
      )}
    >
      <LogOut aria-hidden="true" className="size-4" />
      <span>{pending ? t('shell.signingOut') : t('auth.logout')}</span>
    </button>
  )
}
