'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Label } from '@zihin/ui/label'
import { Textarea } from '@zihin/ui/textarea'
import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  OPTION_KEYS,
  type OptionKey,
} from '@/lib/admin/questions/options'
import { fill } from '@/lib/i18n/core'
import { questionStrings } from './strings'

/**
 * Şık düzenleyici: 2-5 şık, ekle / kaldır / sırala, doğru şıkkı işaretle.
 *
 * ANAHTARLAR HER ZAMAN BAŞTAN VERİLİR (A, B, C…). Editör ortadaki şıkkı silince
 * geriye A, C, D kalması ve öğrenciye böyle gösterilmesi kabul edilemez; sıra
 * değiştiğinde doğru şık İŞARETLENDİĞİ METİNLE birlikte taşınır — bu bileşenin
 * asıl işi budur. Doğru şık seçimi radyo grubudur: tek seçim, klavyeyle ok
 * tuşlarıyla gezilir.
 */

export type EditableOption = {
  /** Kararlı kimlik: sıralamada React'in metinleri karıştırmaması için. */
  uid: string
  text: string
}

export function newOption(): EditableOption {
  return { uid: crypto.randomUUID(), text: '' }
}

type OptionEditorProps = {
  options: EditableOption[]
  onChange: (options: EditableOption[]) => void
  /** Doğru şıkkın `uid`i — harf değil: sıra değişince harf kayar, uid kalmaz. */
  correctUid: string | null
  onCorrectChange: (uid: string) => void
  error?: string | string[]
  correctError?: string | string[]
  disabled?: boolean
}

export function OptionEditor({
  options,
  onChange,
  correctUid,
  onCorrectChange,
  error,
  correctError,
  disabled,
}: OptionEditorProps) {
  const s = questionStrings()
  const errorId = 'siklar-hata'
  const message = firstMessage(error)
  const correctMessage = firstMessage(correctError)

  function updateText(uid: string, text: string) {
    onChange(options.map((option) => (option.uid === uid ? { ...option, text } : option)))
  }

  function remove(uid: string) {
    onChange(options.filter((option) => option.uid !== uid))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= options.length) return
    const next = [...options]
    const moved = next[index]
    const other = next[target]
    if (!moved || !other) return
    next[index] = other
    next[target] = moved
    onChange(next)
  }

  return (
    <fieldset className="space-y-3" aria-describedby={message ? errorId : undefined}>
      <legend className="text-sm font-medium">{s.optionsLabel}</legend>
      <p className="text-muted-foreground text-xs">{s.optionsHint}</p>

      <ul className="space-y-3">
        {options.map((option, index) => {
          const key = OPTION_KEYS[index] as OptionKey | undefined
          const letter = key ?? '?'
          const inputId = `sik-${option.uid}`
          const isCorrect = correctUid === option.uid

          return (
            <li key={option.uid} className="border-border rounded-md border p-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <input
                    type="radio"
                    name="dogru-sik"
                    id={`dogru-${option.uid}`}
                    checked={isCorrect}
                    disabled={disabled}
                    onChange={() => onCorrectChange(option.uid)}
                    className="accent-primary size-4"
                    aria-label={fill(s.markCorrect, { key: letter })}
                  />
                  <span aria-hidden="true" className="text-muted-foreground text-xs font-semibold">
                    {letter}
                  </span>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor={inputId} className="sr-only">
                    {fill(s.optionText, { key: letter })}
                  </Label>
                  <Textarea
                    id={inputId}
                    rows={2}
                    value={option.text}
                    disabled={disabled}
                    onChange={(event) => updateText(option.uid, event.target.value)}
                    placeholder={fill(s.optionText, { key: letter })}
                  />
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                    <span className="sr-only">{s.moveUp}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled || index === options.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                    <span className="sr-only">{s.moveDown}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled || options.length <= MIN_OPTIONS}
                    onClick={() => remove(option.uid)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    <span className="sr-only">{s.removeOption}</span>
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || options.length >= MAX_OPTIONS}
        onClick={() => onChange([...options, newOption()])}
      >
        <Plus aria-hidden="true" className="size-4" />
        {s.addOption}
      </Button>

      {message ? (
        <p id={errorId} className="text-destructive text-xs font-medium">
          {message}
        </p>
      ) : null}
      {correctMessage ? (
        <p className="text-destructive text-xs font-medium">{correctMessage}</p>
      ) : null}
    </fieldset>
  )
}

function firstMessage(error: string | string[] | undefined): string | undefined {
  if (Array.isArray(error)) return error[0]
  return error || undefined
}
