import { APP_NAME, APP_URL } from '@/lib/env'
import type { RenderedEmail } from './provider'

/**
 * Ortak e-posta iskeleti.
 *
 * MARKA NÖTRDÜR: hiçbir yerde "Zihin" yazmaz; ürün adı `NEXT_PUBLIC_APP_NAME`,
 * adresler `NEXT_PUBLIC_APP_URL` üzerinden gelir. Şablonu kopyalayan bir kurulum
 * yalnızca ortam değişkenini değiştirir.
 *
 * HTML bilinçli olarak ilkel: tablo yok, dış CSS yok, satır içi stil ve tek
 * sütun. E-posta istemcileri arasında en geniş ortak payda budur ve karanlık
 * temayı istemcinin kendisi çevirebilsin diye renk paleti nötr tutuldu
 * (uygulamanın tasarım belirteçleri e-postaya taşınmaz — CSS değişkeni
 * desteklenmiyor).
 *
 * HER ŞABLON aynı alt bilgiyle biter: tercih/abonelikten çıkma satırı
 * `/ayarlar` sayfasını gösterir.
 */

export type EmailAction = {
  label: string
  url: string
}

export type EmailContent = {
  subject: string
  /** Gövdenin üstündeki başlık; genelde konuyla aynı olmaz. */
  heading: string
  /** Sırayla basılan paragraflar. */
  paragraphs: readonly string[]
  /** İsteğe bağlı "şunu yap" düğmesi. */
  action?: EmailAction
  /** Anahtar/değer listesi (haftalık özet gibi sayısal gövdeler için). */
  facts?: ReadonlyArray<{ label: string; value: string }>
}

/** Tercih satırı — yedi şablonun tamamında aynıdır. */
export function preferencesUrl(): string {
  return `${APP_URL.replace(/\/+$/, '')}/ayarlar`
}

export function unsubscribeSentence(): string {
  return `Bu e-postaları almak istemiyorsanız bildirim tercihlerinizi ${preferencesUrl()} adresinden değiştirebilirsiniz.`
}

/** HTML'e gömülen her değişken metin buradan geçer. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Türkçe selamlama; ad bilinmiyorsa kişiselleştirilmeden devam eder. */
export function greeting(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  return trimmed === '' ? 'Merhaba,' : `Merhaba ${trimmed},`
}

/**
 * İçeriği hem HTML hem düz metne çevirir.
 * İki dal aynı `EmailContent`ten üretilir; biri güncellenip diğeri unutulamaz.
 */
export function renderEmail(content: EmailContent): RenderedEmail {
  return {
    subject: content.subject,
    html: renderHtml(content),
    text: renderText(content),
  }
}

function renderHtml(content: EmailContent): string {
  const paragraphs = content.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2430">${escapeHtml(paragraph)}</p>`,
    )
    .join('')

  const facts =
    content.facts && content.facts.length > 0
      ? `<ul style="margin:0 0 16px;padding:0 0 0 18px;font-size:15px;line-height:1.7;color:#1f2430">${content.facts
          .map(
            (fact) =>
              `<li><strong>${escapeHtml(fact.label)}:</strong> ${escapeHtml(fact.value)}</li>`,
          )
          .join('')}</ul>`
      : ''

  const action = content.action
    ? `<p style="margin:0 0 24px"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#1f2430;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(content.action.label)}</a></p>
       <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b7280">Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br /><span style="word-break:break-all">${escapeHtml(content.action.url)}</span></p>`
    : ''

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(content.subject)}</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px">
      <p style="margin:0 0 24px;font-size:16px;font-weight:700;color:#1f2430">${escapeHtml(APP_NAME)}</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#1f2430">${escapeHtml(content.heading)}</h1>
      ${paragraphs}
      ${facts}
      ${action}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
      <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280">
        ${escapeHtml(unsubscribeSentence())}
      </p>
    </div>
  </body>
</html>`
}

function renderText(content: EmailContent): string {
  const lines: string[] = [APP_NAME, '', content.heading, '']

  for (const paragraph of content.paragraphs) {
    lines.push(paragraph, '')
  }

  if (content.facts && content.facts.length > 0) {
    for (const fact of content.facts) {
      lines.push(`- ${fact.label}: ${fact.value}`)
    }
    lines.push('')
  }

  if (content.action) {
    lines.push(`${content.action.label}: ${content.action.url}`, '')
  }

  lines.push('—', unsubscribeSentence())
  return lines.join('\n')
}

/** Uygulama içi göreli yolu tam adrese çevirir. */
export function appUrl(path: string): string {
  const base = APP_URL.replace(/\/+$/, '')
  if (path === '') return base
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}
