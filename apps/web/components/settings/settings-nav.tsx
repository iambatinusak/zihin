import { section } from '@/lib/i18n'

export type SettingsSectionLink = { id: string; label: string }

const s = section<{ nav: string }>('settings')

/**
 * Masaüstünde sayfayla birlikte kaymayan bölüm listesi. Bağlantılar sıradan
 * çapa (#) bağlantısıdır: JavaScript olmadan da çalışır, klavyeyle gezilir.
 * Mobilde gizlenir — 375px'te tek sütun zaten kısa ve kaydırma yeterli.
 */
export function SettingsNav({ items }: { items: SettingsSectionLink[] }) {
  return (
    <nav aria-label={s.nav} className="sticky top-20 hidden lg:block">
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground block rounded-md px-3 py-1.5 transition-colors"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
