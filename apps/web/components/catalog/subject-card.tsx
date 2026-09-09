import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@zihin/ui/card'
import { Progress } from '@zihin/ui/progress'
import type { SubjectOverview } from '@/lib/data'
import { section } from '@/lib/i18n'
import { parseSubjectColor } from './progress'
import { fill } from '@/lib/i18n'
import type { CatalogStrings } from './strings'

/**
 * /dersler ızgarasındaki tek ders kartı.
 *
 * Ders rengi (`subjects.color`) bir HSL üçlüsüdür ve `--subject` değişkenine
 * yazılır; sınıflar bunu `hsl(var(--subject))` ile okur. Değer yoksa belirteç
 * `--primary`ye düşer — yani sabit renk hiçbir durumda yazılmaz ve koyu tema
 * aynı yoldan çalışır. Renk yalnızca ayırt edicidir: her sayı ayrıca metindir.
 */
export function SubjectCard({ subject }: { subject: SubjectOverview }) {
  const s = section<CatalogStrings>('catalog')
  const color = parseSubjectColor(subject.color)
  const style = { '--subject': color ?? 'var(--primary)' } as CSSProperties

  return (
    <Card
      style={style}
      className="focus-within:ring-ring relative overflow-hidden transition-shadow focus-within:ring-2 hover:shadow-md"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[hsl(var(--subject))]" />

      <CardHeader className="pb-2">
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          {/* Kartın tamamı tıklanabilir; klavye odağı yine tek bağlantıda kalır. */}
          <Link
            href={`/dersler/${subject.slug}`}
            className="rounded-sm outline-none after:absolute after:inset-0"
          >
            {subject.name}
          </Link>
          <ChevronRight
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {subject.unitCount} {s.unitCount} · {subject.topicCount} {s.topicCount}
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{s.progress}</span>
          <span className="text-foreground font-medium tabular-nums">
            %{subject.progressPercent}
          </span>
        </div>
        <Progress
          value={subject.progressPercent}
          aria-label={`${subject.name} — ${s.progressHint}`}
          className="bg-[hsl(var(--subject)/0.2)]"
          indicatorClassName="bg-[hsl(var(--subject))]"
        />
        <p className="text-muted-foreground text-xs">
          {fill(s.learnedOfTotal, { learned: subject.learnedCount, total: subject.topicCount })}
        </p>
      </CardContent>
    </Card>
  )
}
