import type { EmailMessage, EmailProvider, SendResult } from './provider'

/**
 * Geliştirme sağlayıcısı: e-postayı göndermez, konsola basar.
 *
 * `RESEND_API_KEY` boşken devreye girer (.env.example bunu belgeliyor). Düz
 * metin gövdesi de basılır — geliştiricinin gördüğü şey, HTML'i olmayan bir
 * istemcinin göreceği şeyle aynıdır; şablonun metin dalının bozulduğu böyle
 * fark edilir.
 */
export function createLogEmailProvider(logger: Pick<Console, 'info'> = console): EmailProvider {
  return {
    name: 'log',
    async send(message: EmailMessage): Promise<SendResult> {
      logger.info(
        [
          '',
          '──────── [mail:log] e-posta gönderilmedi, yalnızca yazdırıldı ────────',
          `Kime   : ${message.to}`,
          `Kimden : ${message.from ?? '(EMAIL_FROM)'}`,
          `Konu   : ${message.subject}`,
          '── metin ──',
          message.text,
          '── html (uzunluk) ──',
          `${message.html.length} karakter`,
          '──────────────────────────────────────────────────────────────────────',
          '',
        ].join('\n'),
      )
      return { provider: 'log', id: null }
    },
  }
}
