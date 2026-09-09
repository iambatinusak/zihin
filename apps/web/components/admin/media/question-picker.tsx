'use client'

import * as React from 'react'
import { Loader2, Search } from 'lucide-react'

import { Button } from '@zihin/ui/button'
import { Input } from '@zihin/ui/input'
import { Badge } from '@zihin/ui/badge'
import { Label } from '@zihin/ui/label'
import { fill, t } from '@/lib/i18n/admin-media'
import { searchQuestions } from '@/lib/media/actions'
import type { QuestionOption } from '@/lib/data/admin-media'

/**
 * Aranabilir soru seçici.
 *
 * Hem video durağı hem test kurucusu kullanır; ikisi de "bir soru bul ve
 * iliştir" işini yapar. Arama sunucudadır (`searchQuestions` action'ı kendi
 * `assertRole` denetimini yapar); soru kökleri istemciye peşin yüklenmez.
 *
 * Yalnızca soru KÖKÜ gösterilir. Doğru cevap ve açıklama bu bileşene hiç
 * gelmez — seçici öğrenciye açık bir yüzey olmasa da, cevabı taşımayan bir
 * veri yolu taşıyan bir veri yolundan güvenlidir.
 */

export type QuestionPickerProps = {
  topicIds: string[]
  /** Zaten seçilmiş sorular listede işaretlenir ve yeniden seçilemez. */
  selectedIds: readonly string[]
  onSelect: (question: QuestionOption) => void
  /** Tek seçim modunda seçilen soru kutunun üstünde gösterilir. */
  multiple?: boolean
  label?: string
}

export function QuestionPicker({
  topicIds,
  selectedIds,
  onSelect,
  multiple = false,
  label,
}: QuestionPickerProps) {
  const [text, setText] = React.useState('')
  const [results, setResults] = React.useState<QuestionOption[]>([])
  const [pending, startTransition] = React.useTransition()
  const [searched, setSearched] = React.useState(false)

  const runSearch = React.useCallback(
    (value: string) => {
      startTransition(async () => {
        const result = await searchQuestions({
          topicIds,
          text: value,
          limit: 30,
        })
        setSearched(true)
        setResults(result.ok ? result.data : [])
      })
    },
    [topicIds],
  )

  // Konu değişince eski sonuçlar yanıltıcı olur; liste sıfırlanır ve
  // (konu seçiliyse) ilk sayfa peşin getirilir.
  React.useEffect(() => {
    setResults([])
    setSearched(false)
    if (topicIds.length > 0) runSearch('')
  }, [topicIds, runSearch])

  const selected = new Set(selectedIds)

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="soru-arama">{label ?? t('adminMedia.checkpointSearch')}</Label>
        <div className="flex gap-2">
          <Input
            id="soru-arama"
            value={text}
            placeholder={t('adminMedia.checkpointSearchHint')}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                runSearch(text)
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={() => runSearch(text)}>
            <Search aria-hidden="true" className="size-4" />
            <span className="sr-only">{t('adminMedia.checkpointSearch')}</span>
          </Button>
        </div>
      </div>

      <div className="border-border max-h-72 overflow-y-auto rounded-md border" aria-busy={pending}>
        {pending ? (
          <p className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t('adminMedia.pickerSearching')}
          </p>
        ) : results.length === 0 ? (
          <p className="text-muted-foreground p-3 text-sm">
            {searched ? t('adminMedia.checkpointSearchEmpty') : t('adminMedia.pickTopicBody')}
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {results.map((question) => {
              const isSelected = selected.has(question.id)
              return (
                <li key={question.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground line-clamp-2 text-sm">{question.stem}</p>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                      <span>
                        {fill(t('adminMedia.pickerDifficulty'), { level: question.difficulty })}
                      </span>
                      {question.isPublished ? null : (
                        <Badge variant="outline">{t('adminMedia.draft')}</Badge>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'outline' : 'secondary'}
                    disabled={isSelected && multiple}
                    onClick={() => onSelect(question)}
                  >
                    {isSelected && multiple
                      ? t('adminMedia.pickerSelected')
                      : t('adminMedia.pickerSelect')}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
