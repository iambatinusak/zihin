import type { ReactNode } from 'react'
import { cn } from '@zihin/ui/lib/utils'
import { helpStrings } from './strings'

/**
 * Bir sorunun yazışması (spec §M11: soru başına en fazla 5 mesaj).
 *
 * Sunucu bileşeni. Mesaj gövdeleri markdown + LaTeX olabildiği için
 * `components/common/markdown.tsx` ile SUNUCUDA basılır ve buraya hazır
 * `ReactNode` olarak gelir (CONVENTIONS: react-markdown/KaTeX istemciye
 * girmez).
 */

export type ConversationMessage = {
  id: string
  /** Gönderen öğretmen mi? Hizalama ve etiket buna göre. */
  fromTeacher: boolean
  body: ReactNode | null
  imageUrl: string | null
  createdAtLabel: string
}

export function Conversation({ messages }: { messages: ConversationMessage[] }) {
  const s = helpStrings()

  if (messages.length === 0) {
    return <p className="text-muted-foreground text-sm">{s.messageEmpty}</p>
  }

  return (
    <ul className="space-y-3">
      {messages.map((message) => (
        <li
          key={message.id}
          className={cn(
            'rounded-lg border p-3',
            message.fromTeacher ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30',
          )}
        >
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            {message.fromTeacher ? s.messageFromTeacher : s.messageFromStudent} ·{' '}
            {message.createdAtLabel}
          </p>
          {message.body ? <div className="text-sm">{message.body}</div> : null}
          {message.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imzalı URL,
            // dış alan adı; next/image için remotePatterns tanımı gerekirdi.
            <img
              src={message.imageUrl}
              alt={s.imagePreview}
              className="border-border mt-2 max-h-96 rounded-md border object-contain"
            />
          ) : null}
        </li>
      ))}
    </ul>
  )
}
