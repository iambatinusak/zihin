'use client'

import * as React from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Textarea } from '@zihin/ui/textarea'
import { Label } from '@zihin/ui/label'
import { addNote, deleteNote, updateNote } from '@/app/(student)/video/actions'
import { NOTE_MAX_LENGTH } from '@/app/(student)/video/schemas'
import { t } from '@/lib/i18n/base'
import { formatClock, formatSpokenTime } from './format'
import { fill } from '@/lib/i18n/base'
import type { VideoStrings } from './strings'

/**
 * Zaman damgalı notlar.
 *
 * Liste her zaman zaman damgasına göre sıralı tutulur; sunucu da aynı sırayla
 * döndürür (bkz. `lib/data/video.ts` → `getNotesForVideo`), böylece sayfa
 * yenilendiğinde sıra değişmez.
 */

export type NoteItem = {
  id: string
  timestampSeconds: number
  body: string
}

type VideoNotesProps = {
  videoId: string
  initialNotes: NoteItem[]
  strings: VideoStrings
  /** Not tıklandığında oynatıcıyı o ana götürür. */
  onSeek: (seconds: number) => void
  /** "Şu an için not ekle" bu konumu kullanır. */
  getCurrentTime: () => number
}

function sortByTimestamp(notes: NoteItem[]): NoteItem[] {
  return [...notes].sort((a, b) => a.timestampSeconds - b.timestampSeconds)
}

export function VideoNotes({
  videoId,
  initialNotes,
  strings,
  onSeek,
  getCurrentTime,
}: VideoNotesProps) {
  const [notes, setNotes] = React.useState<NoteItem[]>(() => sortByTimestamp(initialNotes))
  const [draft, setDraft] = React.useState<{ timestampSeconds: number; body: string } | null>(null)
  const [editing, setEditing] = React.useState<{ id: string; body: string } | null>(null)
  const [pending, setPending] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)

  const draftFieldRef = React.useRef<HTMLTextAreaElement | null>(null)

  function startDraft() {
    setErrorMessage(null)
    setStatus(null)
    setEditing(null)
    setDraft({ timestampSeconds: Math.floor(getCurrentTime()), body: '' })
    // Alan bir sonraki boyamada var olur.
    window.setTimeout(() => draftFieldRef.current?.focus(), 0)
  }

  async function submitDraft() {
    if (!draft || pending) return
    const body = draft.body.trim()
    if (body.length === 0) {
      setErrorMessage(strings.noteEmptyBody)
      return
    }

    setPending(true)
    setErrorMessage(null)
    const result = await addNote({
      videoId,
      timestampSeconds: draft.timestampSeconds,
      body,
    })
    setPending(false)

    if (!result.ok) {
      setErrorMessage(result.error.message)
      return
    }

    setNotes((current) =>
      sortByTimestamp([
        ...current,
        {
          id: result.data.id,
          timestampSeconds: result.data.timestamp_seconds,
          body: result.data.body,
        },
      ]),
    )
    setDraft(null)
    setStatus(strings.noteSaved)
  }

  async function submitEdit() {
    if (!editing || pending) return
    const body = editing.body.trim()
    if (body.length === 0) {
      setErrorMessage(strings.noteEmptyBody)
      return
    }

    setPending(true)
    setErrorMessage(null)
    const result = await updateNote({ noteId: editing.id, body })
    setPending(false)

    if (!result.ok) {
      setErrorMessage(result.error.message)
      return
    }

    setNotes((current) =>
      sortByTimestamp(
        current.map((note) =>
          note.id === editing.id ? { ...note, body: result.data.body } : note,
        ),
      ),
    )
    setEditing(null)
    setStatus(strings.noteUpdated)
  }

  async function removeNote(note: NoteItem) {
    if (pending) return
    if (!window.confirm(strings.noteDeleteConfirm)) return

    setPending(true)
    setErrorMessage(null)
    const result = await deleteNote({ noteId: note.id })
    setPending(false)

    if (!result.ok) {
      setErrorMessage(result.error.message)
      return
    }
    setNotes((current) => current.filter((item) => item.id !== note.id))
    setStatus(strings.noteDeleted)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{strings.notesHint}</p>
        <Button type="button" size="sm" onClick={startDraft} disabled={draft !== null}>
          <Plus aria-hidden="true" className="size-4" />
          {strings.noteAdd}
        </Button>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {errorMessage}
        </p>
      ) : null}

      <p role="status" className="text-muted-foreground text-xs">
        {status}
      </p>

      {draft ? (
        <div className="border-border space-y-2 rounded-md border p-3">
          <Label htmlFor="yeni-not">
            {fill(strings.noteAtTime, { time: formatClock(draft.timestampSeconds) })}
          </Label>
          <Textarea
            id="yeni-not"
            ref={draftFieldRef}
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            value={draft.body}
            placeholder={strings.notePlaceholder}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          />
          <p className="text-muted-foreground text-xs tabular-nums">
            {fill(strings.noteCounter, { count: draft.body.length, max: NOTE_MAX_LENGTH })}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={submitDraft} disabled={pending}>
              {strings.addNote}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={pending}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {notes.length === 0 && !draft ? (
        <p className="text-muted-foreground text-sm">{strings.notesEmpty}</p>
      ) : null}

      <ul aria-label={strings.noteList} className="space-y-2">
        {notes.map((note) => {
          const clock = formatClock(note.timestampSeconds)
          const spoken = formatSpokenTime(note.timestampSeconds)
          const isEditing = editing?.id === note.id

          return (
            <li key={note.id} className="border-border rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSeek(note.timestampSeconds)}
                  aria-label={fill(strings.noteSeek, { time: spoken })}
                  className="text-primary focus-visible:ring-ring rounded text-xs font-medium tabular-nums underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
                >
                  {clock}
                </button>

                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={fill(strings.noteEditLabel, { time: spoken })}
                    onClick={() => {
                      setStatus(null)
                      setErrorMessage(null)
                      setDraft(null)
                      setEditing({ id: note.id, body: note.body })
                    }}
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive size-7"
                    aria-label={fill(strings.noteDeleteLabel, { time: spoken })}
                    onClick={() => void removeNote(note)}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                </span>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <Label htmlFor={`not-${note.id}`} className="sr-only">
                    {strings.editNote}
                  </Label>
                  <Textarea
                    id={`not-${note.id}`}
                    rows={3}
                    maxLength={NOTE_MAX_LENGTH}
                    value={editing.body}
                    onChange={(event) => setEditing({ ...editing, body: event.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={submitEdit} disabled={pending}>
                      {strings.editNote}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(null)}
                      disabled={pending}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-foreground whitespace-pre-wrap break-words text-sm">
                  {note.body}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
