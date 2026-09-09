'use client'

import dynamic from 'next/dynamic'
import { questionStrings } from './strings'

/**
 * Düzenleyicinin canlı önizlemesi.
 *
 * İKİ KURAL:
 *
 *  1. AYNI BORU HATTI. Önizleme, öğrencinin gördüğü `components/common/markdown`
 *     bileşenini kullanır — `rehype-sanitize` dâhil. Editöre temizlenmemiş HTML
 *     göstermek, XSS'in üretime kaçtığı klasik yoldur: editör çalıştığını görür,
 *     öğrenci sanitize edilmiş (ya da edilmemiş) başka bir şey görür.
 *  2. AYRI PAKET. `next/dynamic` + `ssr:false` ile KaTeX ve react-markdown
 *     yalnızca bu ekran açıldığında indirilir; öğrenci paketine binmez.
 */
const Markdown = dynamic(
  () => import('@/components/common/markdown').then((mod) => ({ default: mod.Markdown })),
  {
    ssr: false,
    loading: function PreviewLoading() {
      return <p className="text-muted-foreground text-sm">{questionStrings().previewLoading}</p>
    },
  },
)

export function MarkdownPreview({ content, label }: { content: string; label?: string }) {
  const s = questionStrings()
  const isEmpty = content.trim().length === 0

  return (
    <div
      aria-live="polite"
      aria-label={label ?? s.previewTitle}
      className="border-border bg-muted/30 min-h-24 rounded-md border p-3"
    >
      {isEmpty ? (
        <p className="text-muted-foreground text-sm">{s.previewEmpty}</p>
      ) : (
        <Markdown content={content} />
      )}
    </div>
  )
}
