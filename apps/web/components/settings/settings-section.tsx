import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader } from '@zihin/ui/card'

type SettingsSectionProps = {
  /** Sayfa içi gezinmenin hedefi; başlıkla ilişkilendirilir. */
  id: string
  title: string
  description?: string
  children: ReactNode
}

/**
 * Ayarlar sayfasındaki her bölümün ortak kabuğu.
 * `aria-labelledby` ile bölüm başlığı, ekran okuyucuda bölgeye ad olur.
 */
export function SettingsSection({ id, title, description, children }: SettingsSectionProps) {
  const headingId = `${id}-baslik`

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20">
      <Card>
        <CardHeader>
          {/* CardTitle bir <div>; bölüm başlığının gerçekten h2 olması gerekiyor. */}
          <h2 id={headingId} className="text-lg font-semibold leading-none">
            {title}
          </h2>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  )
}
