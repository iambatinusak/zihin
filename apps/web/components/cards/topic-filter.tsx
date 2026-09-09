import { Label } from '@zihin/ui/label'
import { Button } from '@zihin/ui/button'
import { section } from '@/lib/i18n'
import { fill } from '@/lib/i18n'
import type { CardStrings } from './strings'

/**
 * Konu seçici.
 *
 * Bilerek düz bir GET formudur: sunucu bileşeni olarak kalır, JavaScript
 * olmadan da çalışır ve seçim adres çubuğunda görünür (`/kartlar?konu=turev`
 * bağlantısı paylaşılabilir — müfredat ekranındaki "Kartları aç" bağlantısı da
 * zaten bu biçimi kullanıyor).
 */

export type TopicFilterOption = {
  slug: string
  label: string
  cardCount: number
}

export function TopicFilter({
  options,
  selectedSlug,
}: {
  options: TopicFilterOption[]
  selectedSlug: string | null
}) {
  const s = section<CardStrings>('cards')

  if (options.length === 0) {
    return <p className="text-muted-foreground text-sm">{s.filterEmpty}</p>
  }

  return (
    <form method="get" action="/kartlar" className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-sm">
        <Label htmlFor="kart-konu">{s.filterLabel}</Label>
        <select
          id="kart-konu"
          name="konu"
          defaultValue={selectedSlug ?? ''}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <option value="">{s.filterAll}</option>
          {options.map((option) => (
            <option key={option.slug} value={option.slug}>
              {`${option.label} — ${fill(s.topicCardCount, { count: option.cardCount })}`}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        {s.filterApply}
      </Button>
    </form>
  )
}
