import type { StudyBlockType } from '@zihin/core'

/**
 * Blok türünün görsel karşılıkları — saf eşleme, bileşenden ayrı tutulur ki
 * test edilebilsin ve dört tür de tek yerde tanımlansın.
 *
 * Renk TEK BAŞINA anlam taşımaz (CONVENTIONS §8): her kart ayrıca Türkçe tür
 * etiketi ve bir ikon gösterir. Bu yüzden renk yazıya değil, kartın sol
 * kenarlığına ve ikona uygulanır — kontrast riski olmadan ayırt edicilik.
 */

export const BLOCK_TYPES: readonly StudyBlockType[] = ['watch', 'solve', 'review', 'mock']

export type BlockVisual = {
  /** `program.blockTypes.*` sözlük anahtarının son parçası. */
  labelKey: StudyBlockType
  /** Kartın sol kenarlığı. */
  borderClass: string
  /** İkon rengi. */
  iconClass: string
  /** Tür rozetinin arka planı — düşük doygunlukta, metin `text-foreground`. */
  chipClass: string
}

const VISUALS: Record<StudyBlockType, BlockVisual> = {
  watch: {
    labelKey: 'watch',
    borderClass: 'border-l-block-watch',
    iconClass: 'text-block-watch',
    chipClass: 'bg-block-watch/10 text-foreground',
  },
  solve: {
    labelKey: 'solve',
    borderClass: 'border-l-block-solve',
    iconClass: 'text-block-solve',
    chipClass: 'bg-block-solve/10 text-foreground',
  },
  review: {
    labelKey: 'review',
    borderClass: 'border-l-block-review',
    iconClass: 'text-block-review',
    chipClass: 'bg-block-review/10 text-foreground',
  },
  mock: {
    labelKey: 'mock',
    borderClass: 'border-l-block-mock',
    iconClass: 'text-block-mock',
    chipClass: 'bg-block-mock/10 text-foreground',
  },
}

/** Bilinmeyen tür gelirse (şema genişlerse) kart yine çizilir, nötr görünür. */
const FALLBACK: BlockVisual = {
  labelKey: 'watch',
  borderClass: 'border-l-border',
  iconClass: 'text-muted-foreground',
  chipClass: 'bg-muted text-foreground',
}

export function blockVisual(type: StudyBlockType): BlockVisual {
  return VISUALS[type] ?? FALLBACK
}
