'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@zihin/ui/badge'
import { Button } from '@zihin/ui/button'
import { Card, CardContent } from '@zihin/ui/card'
import { Input } from '@zihin/ui/input'
import { Switch } from '@zihin/ui/switch'
import { Textarea } from '@zihin/ui/textarea'
import {
  Field,
  FormErrorSummary,
  FormSuccess,
  SubmitButton,
  SwitchRow,
  type FieldErrors,
} from '@/components/common/form-parts'
import { EmptyState } from '@/components/common/empty-state'
import { t } from '@/lib/i18n/admin-media'
import {
  createFlashcard,
  deleteFlashcard,
  updateFlashcard,
} from '@/app/(admin)/admin/kartlar/actions'
import { MarkdownPreview } from './markdown-preview'
import type { AdminFlashcard } from '@/lib/data/admin-media'

/**
 * Bilgi kartı listesi + düzenleyici (spec §M15).
 *
 * Listede YALNIZCA editör kartları vardır. Öğrencilerin yanlışlarından
 * otomatik üretilen kartlar (`auto_generated = true`) kişiseldir: sahibinin
 * tekrar kuyruğuna bağlıdır ve başka birinin düzenlemesi hem o kuyruğu bozar
 * hem de kişisel veriye dokunur. Süzgeç veri katmanında
 * (`getAdminFlashcards`) ve ayrıca her yazma sorgusunda uygulanır.
 */

type FlashcardEditorProps = {
  topicId: string
  cards: AdminFlashcard[]
}

export function FlashcardEditor({ topicId, cards }: FlashcardEditorProps) {
  const router = useRouter()
  const [editing, setEditing] = React.useState<AdminFlashcard | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [listError, setListError] = React.useState<string | null>(null)

  function remove(id: string) {
    if (!window.confirm(t('adminMedia.deleteConfirm'))) return
    setListError(null)
    startTransition(async () => {
      const result = await deleteFlashcard({ id })
      if (!result.ok) {
        setListError(result.error.message)
        return
      }
      if (editing?.id === id) setEditing(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{t('adminMedia.cardsAutoNote')}</p>

      {listError ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {listError}
        </p>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title={t('adminMedia.cardsEmptyTitle')}
          description={t('adminMedia.cardsEmptyBody')}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-busy={pending}>
          {cards.map((card) => (
            <li key={card.id} className="border-border space-y-2 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground line-clamp-3 flex-1 whitespace-pre-wrap text-sm">
                  {card.front}
                </p>
                <Badge variant={card.is_published ? 'default' : 'outline'}>
                  {card.is_published ? t('adminMedia.published') : t('adminMedia.draft')}
                </Badge>
              </div>
              <p className="text-muted-foreground line-clamp-2 whitespace-pre-wrap text-xs">
                {card.back}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing(card)}
                >
                  {t('adminMedia.edit')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => remove(card.id)}
                >
                  {t('adminMedia.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <h2 className="text-foreground text-lg font-semibold">
          {editing ? t('adminMedia.cardEdit') : t('adminMedia.cardNew')}
        </h2>
        <FlashcardForm
          // key: düzenlenen kart değişince form durumu sıfırlansın.
          key={editing?.id ?? 'yeni'}
          topicId={topicId}
          card={editing}
          onDone={() => {
            setEditing(null)
            router.refresh()
          }}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
      </section>
    </div>
  )
}

function FlashcardForm({
  topicId,
  card,
  onDone,
  onCancel,
}: {
  topicId: string
  card: AdminFlashcard | null
  onDone: () => void
  onCancel?: () => void
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [success, setSuccess] = React.useState(false)

  const [front, setFront] = React.useState(card?.front ?? '')
  const [back, setBack] = React.useState(card?.back ?? '')
  const [isPublished, setIsPublished] = React.useState(card?.is_published ?? true)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)

    setError(null)
    setFieldErrors({})
    setSuccess(false)

    const payload = {
      topicId,
      front,
      back,
      imageUrl: String(data.get('imageUrl') ?? ''),
      isPublished,
    }

    startTransition(async () => {
      const result = card
        ? await updateFlashcard({ ...payload, id: card.id })
        : await createFlashcard(payload)

      if (!result.ok) {
        setError(result.error.message)
        setFieldErrors(result.error.fieldErrors ?? {})
        return
      }

      setSuccess(true)
      if (!card) {
        setFront('')
        setBack('')
      }
      onDone()
    })
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormErrorSummary message={error} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Field id="front" label={t('adminMedia.cardFront')} error={fieldErrors.front}>
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={6}
                  value={front}
                  onChange={(event) => setFront(event.target.value)}
                />
              )}
            </Field>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('adminMedia.cardPreview')}</p>
              <MarkdownPreview content={front} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field id="back" label={t('adminMedia.cardBack')} error={fieldErrors.back}>
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={6}
                  value={back}
                  onChange={(event) => setBack(event.target.value)}
                />
              )}
            </Field>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('adminMedia.cardPreview')}</p>
              <MarkdownPreview content={back} />
            </div>
          </div>

          <Field
            id="imageUrl"
            label={t('adminMedia.cardImage')}
            hint={t('adminMedia.cardImageHint')}
            error={fieldErrors.imageUrl}
          >
            {(aria) => <Input {...aria} name="imageUrl" defaultValue={card?.image_url ?? ''} />}
          </Field>

          <SwitchRow id="isPublished" label={t('adminMedia.cardPublished')}>
            {(aria) => <Switch {...aria} checked={isPublished} onCheckedChange={setIsPublished} />}
          </SwitchRow>

          <div className="flex items-center gap-3">
            <SubmitButton
              pending={pending}
              label={card ? t('adminMedia.save') : t('adminMedia.create')}
              pendingLabel={card ? t('adminMedia.saving') : t('adminMedia.creating')}
            />
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t('adminMedia.cancel')}
              </Button>
            ) : null}
            <FormSuccess show={success} message={t('adminMedia.saved')} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
