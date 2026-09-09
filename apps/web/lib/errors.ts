/**
 * Tüm Server Action'lar aynı zarfı döner:
 *   { ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }
 * Böylece istemci tarafında tek bir hata işleme yolu olur.
 */
export type ActionError = {
  code: ActionErrorCode
  message: string
  fieldErrors?: Record<string, string[]>
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }

export const ACTION_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'not_found',
  'validation',
  'conflict',
  'rate_limited',
  'subscription_required',
  'email_unverified',
  'onboarding_required',
  'internal',
] as const

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number]

/** Kullanıcıya gösterilmek üzere üretilen, beklenen hata. */
export class AppError extends Error {
  readonly code: ActionErrorCode
  readonly fieldErrors?: Record<string, string[]>

  constructor(code: ActionErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export const ERROR_MESSAGES: Record<ActionErrorCode, string> = {
  unauthenticated: 'Bu işlem için giriş yapmalısınız.',
  forbidden: 'Bu işlem için yetkiniz yok.',
  not_found: 'Aradığınız kayıt bulunamadı.',
  validation: 'Gönderilen bilgiler geçerli değil.',
  conflict: 'Bu işlem mevcut kayıtla çakışıyor.',
  rate_limited: 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.',
  subscription_required: 'Bu içeriğe erişmek için aktif bir aboneliğiniz olmalı.',
  email_unverified: 'Devam etmek için e-posta adresinizi doğrulayın.',
  onboarding_required: 'Önce başlangıç adımlarını tamamlayın.',
  internal: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(
  code: ActionErrorCode,
  message?: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error: { code, message: message ?? ERROR_MESSAGES[code], fieldErrors } }
}
