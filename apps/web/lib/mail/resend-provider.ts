import { serverEnv } from '@/lib/env'
import type { EmailMessage, EmailProvider, SendResult } from './provider'

/**
 * Resend sağlayıcısı.
 *
 * SDK yerine doğrudan HTTP kullanılıyor: tek uç, tek gövde: bir bağımlılık
 * eklemeye değmiyor ve testte `fetch` sahtelemek `resend` paketini
 * sahtelemekten basit.
 *
 * Anahtar EKSİKSE burada fırlatılır, modül yüklenirken değil — yanlış
 * yapılandırılmış bir kurulum uygulamanın açılışını engellemesin
 * (`lib/video/index.ts` ile aynı yaklaşım). Zaten anahtar boşken
 * `getEmailProvider()` log sağlayıcısını seçer; buraya ancak anahtar varken
 * gelinir.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function createResendEmailProvider(): EmailProvider {
  return {
    name: 'resend',
    async send(message: EmailMessage): Promise<SendResult> {
      const env = serverEnv()
      const apiKey = env.RESEND_API_KEY

      if (!apiKey) {
        throw new Error('RESEND_API_KEY tanımlı değil; e-posta gönderilemez.')
      }

      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from ?? env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      })

      if (!response.ok) {
        // Gövde loglanır ama çağırana sızmaz; sarmalayıcı zaten yutacak.
        const body = await response.text().catch(() => '')
        throw new Error(`Resend ${response.status}: ${body.slice(0, 500)}`)
      }

      const data = (await response.json().catch(() => null)) as { id?: string } | null
      return { provider: 'resend', id: data?.id ?? null }
    },
  }
}
