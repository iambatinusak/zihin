'use client'

import * as React from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@zihin/ui/button'
import { Input } from '@zihin/ui/input'
import { Label } from '@zihin/ui/label'
import { cn } from '@zihin/ui/lib/utils'
import { LiveRegion } from '@/components/common/live-region'
import { t } from '@/lib/i18n/auth'

/**
 * Uygulamadaki TÜM formların ortak parçaları.
 *
 * Kimlik, onboarding, ayarlar ve veli akışları paralel yazıldığı için bir süre
 * iki ayrı kopya (`components/auth/form-parts`, `components/settings/form-parts`)
 * vardı; hata özeti bir yerde `<div role="alert">`, diğerinde `<p role="alert">`
 * idi ve `Field` iki farklı sözleşme sunuyordu. Tek kaynak burasıdır.
 *
 * Erişilebilirlik sözleşmesi:
 *  - her girdinin gerçek bir `<Label htmlFor>` bağı vardır,
 *  - hata ve yardım metni `aria-describedby` ile girdiye bağlanır,
 *  - hatalı girdi `aria-invalid` taşır,
 *  - form düzeyindeki hata `role="alert"` ile anında duyurulur.
 */

export type FieldErrors = Record<string, string[] | undefined>

/** `Field`in çocuğuna verdiği, doğrudan girdiye yayılabilen öznitelikler. */
export type FieldAria = {
  id: string
  'aria-invalid': boolean | undefined
  'aria-describedby': string | undefined
}

function firstMessage(error: string | string[] | undefined): string | undefined {
  if (Array.isArray(error)) return error[0]
  return error || undefined
}

/** Formun tepesindeki hata özeti. Ekran okuyucu anında duyurur. */
export function FormErrorSummary({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

/**
 * Kaydetme sonrası kısa onay.
 *
 * Duyuru ile görsel onay AYRI düğümlerdir. Eskiden tek bir `role="status"`
 * paragrafı vardı ve `show` false iken hiç basılmıyordu; sonradan eklenen bir
 * canlı bölge okunmadığı için onay ekran okuyucuya HİÇ ulaşmıyordu.
 */
export function FormSuccess({ show, message }: { show: boolean; message?: string }) {
  const text = message ?? t('common.saved')
  return (
    <>
      <LiveRegion message={show ? text : ''} />
      {show ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CheckCircle2 aria-hidden="true" className="text-primary size-4" />
          {text}
        </p>
      ) : null}
    </>
  )
}

type FieldProps = {
  id: string
  label: string
  /** Tek mesaj ya da Zod'un alan hata dizisi; ilki gösterilir. */
  error?: string | string[]
  hint?: string
  className?: string
  children: (aria: FieldAria) => React.ReactNode
}

/** Etiket + alan + yardım metni + hata mesajı düzeni. */
export function Field({ id, label, error, hint, className, children }: FieldProps) {
  const errorId = `${id}-hata`
  const hintId = `${id}-aciklama`
  const message = firstMessage(error)
  const describedBy = [message ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': message ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p id={errorId} className="text-destructive text-xs font-medium">
          {message}
        </p>
      ) : null}
    </div>
  )
}

/** Görünürlük düğmesi olan şifre alanı. */
export function PasswordInput({
  className,
  ...props
}: React.ComponentProps<'input'> & { id: string }) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md focus-visible:outline-none focus-visible:ring-[3px]"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
        <span className="sr-only">{visible ? t('auth.hidePassword') : t('auth.showPassword')}</span>
      </button>
    </div>
  )
}

type SubmitButtonProps = {
  pending: boolean
  /** Varsayılan "Kaydet"; kimlik formları kendi eylem adını verir. */
  label?: string
  pendingLabel?: string
  /** Kimlik kartlarında düğme tam genişlik, ayarlar bölümlerinde değil. */
  fullWidth?: boolean
  className?: string
}

/** Bekleme durumunda kilitlenen, dönen simge ve Türkçe etiket gösteren buton. */
export function SubmitButton({
  pending,
  label,
  pendingLabel,
  fullWidth,
  className,
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(fullWidth && 'w-full', className)}
    >
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {pending ? (pendingLabel ?? t('common.saving')) : (label ?? t('common.save'))}
    </Button>
  )
}

/**
 * Anahtar satırı: metin solda, `Switch` sağda; etiket tıklanabilir kalır.
 *
 * Denetim bir render fonksiyonu olarak alınır: aksi hâlde her çağıran
 * `aria-describedby`yi elle, üstelik burada üretilen kimliği tahmin ederek
 * yazmak zorunda kalır — iki taraf kolayca ayrışır.
 */
export function SwitchRow({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: (aria: { id: string; 'aria-describedby': string | undefined }) => React.ReactNode
}) {
  const hintId = hint ? `${id}-aciklama` : undefined

  return (
    <div className="border-border flex items-start justify-between gap-4 border-b py-4 last:border-b-0">
      <div className="space-y-1">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        {hint ? (
          <p id={hintId} className="text-muted-foreground text-xs">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="pt-0.5">{children({ id, 'aria-describedby': hintId })}</div>
    </div>
  )
}
