import 'server-only'

import { z } from 'zod'
import { AppError, fail, ok, type ActionResult } from '@/lib/errors'

type Handler<TInput, TOutput> = (input: TInput) => Promise<TOutput>

/**
 * Server Action sarmalayıcısı.
 *
 *  1. Girdi Zod şemasıyla doğrulanır (alan bazlı Türkçe hatalar döner).
 *  2. Handler çalışır.
 *  3. Her sonuç `{ ok }` zarfına çevrilir; beklenmeyen hatalar loglanır ama
 *     istemciye iç detay sızmaz.
 *
 * Kullanım:
 *   export const saveProgress = action(SaveProgressSchema, async (input) => { ... })
 */
export function action<TSchema extends z.ZodTypeAny, TOutput>(
  schema: TSchema,
  handler: Handler<z.infer<TSchema>, TOutput>,
) {
  return async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    const parsed = schema.safeParse(rawInput)

    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      return fail(
        'validation',
        'Gönderilen bilgiler geçerli değil.',
        flattened.fieldErrors as Record<string, string[]>,
      )
    }

    try {
      return ok(await handler(parsed.data))
    } catch (error) {
      return toActionResult(error)
    }
  }
}

/** Girdisi olmayan action'lar için. */
export function actionNoInput<TOutput>(handler: () => Promise<TOutput>) {
  return async (): Promise<ActionResult<TOutput>> => {
    try {
      return ok(await handler())
    } catch (error) {
      return toActionResult(error)
    }
  }
}

function toActionResult(error: unknown): ActionResult<never> {
  // Next.js'in redirect()/notFound() sinyalleri yakalanmamalı, yukarı gitmeli.
  if (isNextControlFlowError(error)) throw error

  if (error instanceof AppError) {
    return fail(error.code, error.message, error.fieldErrors)
  }

  console.error('[action] beklenmeyen hata:', error)
  return fail('internal')
}

function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const digest = (error as { digest?: unknown }).digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
  )
}
