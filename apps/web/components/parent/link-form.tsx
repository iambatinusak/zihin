'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@zihin/ui/input'
import { linkParentByInviteCode } from '@/app/(student)/ayarlar/actions'
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@/app/(student)/ayarlar/schemas'
import { Field, FormErrorSummary, SubmitButton } from '@/components/common/form-parts'
import { useSettingsAction } from '@/components/settings/use-settings-action'
import { section } from '@/lib/i18n/settings'

const s = section<{
  formTitle: string
  formDescription: string
  codeInput: string
  codeInputHint: string
  submit: string
  submitting: string
  linked: string
}>('link')

type LinkFormProps = {
  /** Bağlantı kurulduktan sonra gidilecek yol; verilmezse sayfa tazelenir. */
  redirectTo?: string
}

/**
 * Velinin öğrenci davet kodunu girdiği form.
 * Veli alanı (`/veli`) ve öğrenci ekleme akışı bu bileşeni paylaşır.
 */
export function ParentLinkForm({ redirectTo }: LinkFormProps) {
  const [code, setCode] = useState('')
  const router = useRouter()
  const { submit, pending, error, fieldError } = useSettingsAction(linkParentByInviteCode)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(
      { code },
      {
        onSuccess: () => {
          setCode('')
          toast.success(s.linked)
          if (redirectTo) router.push(redirectTo)
          else router.refresh()
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormErrorSummary message={error} />

      <Field
        id="veli-davet-kodu"
        label={s.codeInput}
        hint={s.codeInputHint}
        error={fieldError('code')}
      >
        {(props) => (
          <Input
            {...props}
            name="code"
            value={code}
            // Kod sözlü paylaşılıyor; kullanıcı tire/boşlukla yazsa da kabul edilir.
            onChange={(event) => setCode(normalizeInviteCode(event.target.value))}
            // maxLength normalleştirmeden SONRA uygulanır; ayırıcılar sayılmaz.
            maxLength={INVITE_CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            className="font-mono text-lg uppercase tracking-[0.3em]"
          />
        )}
      </Field>

      <SubmitButton pending={pending} label={s.submit} pendingLabel={s.submitting} />
    </form>
  )
}
