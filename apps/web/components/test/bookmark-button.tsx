'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { bookmarkQuestion, removeBookmark } from '@/app/(student)/test/actions'
import { section } from '@/lib/i18n/test'
import type { TestStrings } from './strings'

/**
 * "Bu soruyu işaretle" — yanlış soru defteri (spec §9.9).
 *
 * İyimser çalışır: durum önce ekranda değişir, sunucu reddederse GERİ ALINIR.
 * Sessiz başarısızlık yok; kullanıcı işaretlediğini sanıp defterini boş
 * bulmasın.
 */
export function BookmarkButton({
  questionId,
  initialBookmarked,
}: {
  questionId: string
  initialBookmarked: boolean
}) {
  const s = section<TestStrings>('test')
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked)
  const [pending, setPending] = React.useState(false)

  async function toggle() {
    if (pending) return
    const next = !bookmarked
    setBookmarked(next)
    setPending(true)

    try {
      const result = next
        ? await bookmarkQuestion({ questionId, note: null })
        : await removeBookmark({ questionId })

      if (result.ok) {
        toast.success(next ? s.bookmark.added : s.bookmark.removed)
      } else {
        setBookmarked(!next)
        toast.error(result.error.message)
      }
    } catch {
      setBookmarked(!next)
      toast.error(s.result.bookmarkFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={bookmarked ? 'secondary' : 'outline'}
      aria-pressed={bookmarked}
      disabled={pending}
      aria-busy={pending}
      onClick={() => void toggle()}
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : bookmarked ? (
        <BookmarkCheck aria-hidden="true" className="size-4" />
      ) : (
        <Bookmark aria-hidden="true" className="size-4" />
      )}
      {bookmarked ? s.bookmark.remove : s.bookmark.add}
    </Button>
  )
}
