import { serverEnv } from '@/lib/env'
import { createLogEmailProvider } from './log-provider'
import { createResendEmailProvider } from './resend-provider'
import type { EmailMessage, EmailProvider, EmailProviderName, SendResult } from './provider'

export type {
  EmailMessage,
  EmailProvider,
  EmailProviderName,
  RenderedEmail,
  SendResult,
} from './provider'

/**
 * Sağlayıcı seçimi ve gönderim yüzeyi (spec §M16).
 *
 * SEÇİM TEK KURALDIR: `RESEND_API_KEY` doluysa Resend, değilse log. Ayrı bir
 * `EMAIL_PROVIDER` değişkeni yok — iki kaynak birbirine düşerse geliştirme
 * ortamında sessizce gerçek e-posta gitmeye başlar.
 */

/** Saf seçim kuralı; testlerde ortamdan bağımsız denenebilsin diye ayrı. */
export function resolveEmailProviderName(apiKey: string | null | undefined): EmailProviderName {
  return typeof apiKey === 'string' && apiKey.trim().length > 0 ? 'resend' : 'log'
}

const FACTORIES: Record<EmailProviderName, () => EmailProvider> = {
  resend: createResendEmailProvider,
  log: createLogEmailProvider,
}

/** Yürürlükteki sağlayıcı. */
export function getEmailProvider(name?: EmailProviderName): EmailProvider {
  const selected = name ?? resolveEmailProviderName(serverEnv().RESEND_API_KEY)
  return FACTORIES[selected]()
}

/**
 * GÖNDERİM ÇAĞIRANI ASLA KIRMAZ.
 *
 * Bir e-posta, tetikleyen işlemin yan etkisidir; onun sonucu değildir.
 * Öğrencinin sorusu kaydedildikten sonra Resend 500 dönerse soru kaybolmaz;
 * cron partisi bir alıcıda patlarsa kalan alıcılar bildirimini alır. Bu yüzden
 * gönderim yolu HER ZAMAN bu sarmalayıcıdan geçer ve `false` döner.
 *
 * Adres boşsa hiç denenmez — sağlayıcıya boş alıcı göndermek gereksiz bir hata.
 */
export async function sendEmailQuietly(
  message: EmailMessage,
  provider: EmailProvider = getEmailProvider(),
): Promise<SendResult | null> {
  if (message.to.trim() === '') return null

  try {
    return await provider.send(message)
  } catch (error) {
    console.error('[mail] e-posta gönderilemedi:', error)
    return null
  }
}

/**
 * Aynı sağlayıcıyla sıralı toplu gönderim; başarılı gönderim sayısını döner.
 * Sıralı olmasının sebebi hız değil, sağlayıcı hız sınırı: paralel yüzlerce
 * istek 429 alır ve hepsi birden kaybolur.
 */
export async function sendEmailBatchQuietly(
  messages: readonly EmailMessage[],
  provider: EmailProvider = getEmailProvider(),
): Promise<number> {
  let sent = 0
  for (const message of messages) {
    const result = await sendEmailQuietly(message, provider)
    if (result) sent += 1
  }
  return sent
}
