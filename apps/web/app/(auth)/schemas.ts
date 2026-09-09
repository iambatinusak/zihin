import { z } from 'zod'

/**
 * Kimlik doğrulama formlarının şemaları.
 *
 * Ayrı dosyada duruyorlar çünkü `actions.ts` bir `'use server'` modülüdür ve
 * oradan yalnızca async fonksiyon dışa aktarılabilir; şemalar ise istemci
 * tarafındaki formların da doğrulama kaynağıdır.
 */

/** Şifre kuralı: en az 8 karakter, en az bir harf ve en az bir rakam. */
export const PASSWORD_MIN_LENGTH = 8

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`)
  .max(72, 'Şifre en fazla 72 karakter olabilir.')
  .refine((value) => /\p{L}/u.test(value), 'Şifre en az bir harf içermeli.')
  .refine((value) => /\d/.test(value), 'Şifre en az bir rakam içermeli.')

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'E-posta adresi zorunlu.')
  .email('Geçerli bir e-posta adresi girin.')
  .toLowerCase()

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, 'Ad soyad en az 3 karakter olmalı.')
  .max(80, 'Ad soyad en fazla 80 karakter olabilir.')

/**
 * Davet kodu: tanım `lib/invite-code.ts`te. Kayıt formu ile veli panelindeki
 * form aynı normalleştirmeyi ve aynı alfabeyi kullanmalı — biri tireyi temizleyip
 * diğeri reddederse aynı kod bir yerde geçer, öbüründe geçmez.
 */
export { INVITE_CODE_LENGTH, normalizeInviteCode } from '@/lib/invite-code'
import { inviteCodeField } from '@/lib/invite-code'

export const kvkkConsentSchema = z.literal(true, {
  errorMap: () => ({ message: 'Devam etmek için açık rıza metnini onaylamalısınız.' }),
})

export const SignInSchema = z.object({
  email: emailSchema,
  // Girişte şifre kuralı uygulanmaz: eski şifreler de kabul edilmeli.
  password: z.string().min(1, 'Şifre zorunlu.'),
  next: z.string().optional(),
})
export type SignInInput = z.infer<typeof SignInSchema>

const registerBase = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  passwordConfirm: z.string().min(1, 'Şifre tekrarı zorunlu.'),
  kvkkConsent: kvkkConsentSchema,
})

/** Şifre eşleşmesi tekrar alanına bağlanır; hata doğru inputun altında çıksın. */
const passwordsMatch = <T extends { password: string; passwordConfirm: string }>(
  schema: z.ZodType<T>,
) =>
  schema.refine((value) => value.password === value.passwordConfirm, {
    message: 'Şifreler eşleşmiyor.',
    path: ['passwordConfirm'],
  })

export const RegisterStudentSchema = passwordsMatch(registerBase)
export type RegisterStudentInput = z.infer<typeof RegisterStudentSchema>

export const RegisterParentSchema = passwordsMatch(
  registerBase.extend({ inviteCode: inviteCodeField }),
)
export type RegisterParentInput = z.infer<typeof RegisterParentSchema>

export const RequestPasswordResetSchema = z.object({ email: emailSchema })
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>

export const ResetPasswordSchema = passwordsMatch(
  z.object({
    password: passwordSchema,
    passwordConfirm: z.string().min(1, 'Şifre tekrarı zorunlu.'),
  }),
)
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>

export const ResendVerificationSchema = z.object({ email: emailSchema })
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>
