'use client'

import dynamic from 'next/dynamic'

import { t } from '@/lib/i18n/admin-media'

/**
 * Kart düzenleyicisinin CANLI önizlemesi.
 *
 * Kural, Markdown'ın sunucuda basılmasıdır (`components/common/markdown.tsx`).
 * Buradaki tek meşru istisna: editör yazarken sonucu görmeli, her tuşta
 * sunucuya gidilemez. Bu yüzden aynı — aynı, kopyası değil — temizleyici
 * renderer `next/dynamic` ile yalnızca bu ekranda, yalnızca istemcide
 * yüklenir. KaTeX ve react-markdown paylaşılan pakete girmez.
 */
const Markdown = dynamic(
  () => import('@/components/common/markdown').then((module) => module.Markdown),
  {
    ssr: false,
    loading: () => <p className="text-muted-foreground text-xs">…</p>,
  },
)

export function MarkdownPreview({ content }: { content: string }) {
  const trimmed = content.trim()

  return (
    <div className="border-border bg-muted/30 min-h-24 rounded-md border p-3">
      {trimmed === '' ? (
        <p className="text-muted-foreground text-xs">{t('adminMedia.cardPreviewEmpty')}</p>
      ) : (
        <Markdown content={trimmed} />
      )}
    </div>
  )
}
