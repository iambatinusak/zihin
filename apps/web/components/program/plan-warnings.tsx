import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@zihin/ui/alert'
import type { ProgramStrings } from './strings'

/**
 * Programın uyarıları — "yetişmiyor", "günlük süre yetersiz", "sınav tarihi
 * geçmiş" gibi. Ekranın köşesine sıkıştırılmaz: öğrencinin programının
 * hedefine yetişmediğini öğrendiği tek yer burasıdır.
 *
 * Metin sözlükten gelmez, PLANIN KENDİSİNDEN gelir: uyarıları üreten
 * `@zihin/core` zaten Türkçe yazar ve `study_plans.warnings` sütununda
 * saklanır. Böylece bir plan sonradan bakıldığında da o günkü uyarısını taşır.
 */
export function PlanWarnings({
  warnings,
  strings,
}: {
  warnings: string[]
  strings: ProgramStrings
}) {
  if (warnings.length === 0) return null

  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{strings.warningsTitle}</AlertTitle>
      <AlertDescription>
        <p className="sr-only">{strings.warningsDescription}</p>
        <ul className="list-disc space-y-1 pl-4">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
