/**
 * E-posta sağlayıcı sözleşmesi (spec §M16).
 *
 * Şablonlar ve çağıran katman hangi sağlayıcının kullanıldığını bilmez; tıpkı
 * `lib/video/provider.ts` gibi imzalar arada bir soyutlamayla ayrılır.
 *
 * Değişmez kural: HER mesaj hem `html` hem `text` taşır. Düz metin istemcisi
 * (ya da HTML'i kapatmış bir kullanıcı) boş bir e-posta görmemeli — bu yüzden
 * `text` opsiyonel DEĞİLDİR.
 */

export type EmailProviderName = 'resend' | 'log'

/** Gönderilmeye hazır, tamamen üretilmiş mesaj. */
export type EmailMessage = {
  /** Tek alıcı; toplu gönderim çağıran tarafta döngüyle yapılır. */
  to: string
  subject: string
  html: string
  text: string
  /** Verilmezse `EMAIL_FROM` kullanılır. */
  from?: string
}

/** Şablonların ürettiği gövde; alıcı bilgisi taşımaz. */
export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

export type SendResult = {
  provider: EmailProviderName
  /** Sağlayıcının verdiği kimlik; log sağlayıcısında null. */
  id: string | null
}

export interface EmailProvider {
  readonly name: EmailProviderName
  send(message: EmailMessage): Promise<SendResult>
}
