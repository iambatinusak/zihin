'use client'

import { useCallback, useState, useTransition } from 'react'
import type { ActionResult } from '@/lib/errors'

type Runner<TInput, TOutput> = (input: TInput) => Promise<ActionResult<TOutput>>

type State = {
  error: string | null
  fieldErrors: Record<string, string[]>
  success: boolean
}

const EMPTY: State = { error: null, fieldErrors: {}, success: false }

/**
 * Server Action çağrısının istemci tarafındaki durumu.
 *
 * `ActionResult` zarfı hiçbir zaman throw etmez; hata da başarı da veri olarak
 * döner. Buradaki tek iş onu forma göstermek: bekleme, alan hataları, özet
 * hata ve kısa süreli onay. Beklenmeyen ağ hatası da sessiz kalmaz.
 */
export function useSettingsAction<TInput, TOutput>(run: Runner<TInput, TOutput>) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<State>(EMPTY)

  const submit = useCallback(
    (
      input: TInput,
      handlers?: { onSuccess?: (data: TOutput) => void; onError?: (message: string) => void },
    ) => {
      setState(EMPTY)
      startTransition(async () => {
        try {
          const result = await run(input)
          if (result.ok) {
            setState({ error: null, fieldErrors: {}, success: true })
            handlers?.onSuccess?.(result.data)
            return
          }
          setState({
            error: result.error.message,
            fieldErrors: result.error.fieldErrors ?? {},
            success: false,
          })
          handlers?.onError?.(result.error.message)
        } catch {
          // Ağ kesintisi ya da sunucuya hiç ulaşamama: sessiz kalmaz.
          const message = 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.'
          setState({ error: message, fieldErrors: {}, success: false })
          handlers?.onError?.(message)
        }
      })
    },
    [run],
  )

  const reset = useCallback(() => setState(EMPTY), [])

  return {
    submit,
    reset,
    pending,
    error: state.error,
    success: state.success,
    fieldErrors: state.fieldErrors,
    /** Alanın ilk hatası; `Field` bileşenine doğrudan verilir. */
    fieldError: (name: string) => state.fieldErrors[name]?.[0],
  }
}
