import type { APIRequestContext } from '@playwright/test'

/**
 * Mailpit yardımcıları.
 *
 * Kayıt akışında e-posta doğrulaması ZORUNLUDUR: onaylanmamış hesap
 * `/verify` sayfasında bekler. Docker yığınındaki Mailpit giden tüm postayı
 * yakalar ve HTTP API'siyle okumaya açar; test de kullanıcının yaptığını
 * yapar — postayı açar ve bağlantıya tıklar.
 *
 * Yoklama (poll) ŞART: e-posta gönderimi kaydın kendisinden birkaç yüz
 * milisaniye sonra tamamlanır. Sabit bir `waitForTimeout` ya erken uyanır ya
 * da her koşumda boşa bekler.
 */

export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:14004'

export type MailMessage = {
  id: string
  to: string[]
  subject: string
  html: string
  text: string
}

type MailpitSummary = {
  ID?: string
  To?: Array<{ Address?: string }> | null
  Subject?: string
}

type MailpitDetail = MailpitSummary & { HTML?: string | null; Text?: string | null }

const DEFAULT_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 750

function addressesOf(message: MailpitSummary): string[] {
  return (message.To ?? [])
    .map((entry) => entry.Address?.toLowerCase().trim())
    .filter((value): value is string => Boolean(value))
}

function toMessage(detail: MailpitDetail): MailMessage {
  return {
    id: detail.ID ?? '',
    to: addressesOf(detail),
    subject: detail.Subject ?? '',
    html: detail.HTML ?? '',
    text: detail.Text ?? '',
  }
}

async function readJson<T>(request: APIRequestContext, path: string): Promise<T | null> {
  const response = await request.get(`${MAILPIT_URL}${path}`, { failOnStatusCode: false })
  if (!response.ok()) return null
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

/** Bir kez dener: adrese gelen EN YENİ postayı bulur, yoksa null döner. */
async function findLatestFor(
  request: APIRequestContext,
  email: string,
): Promise<MailMessage | null> {
  const target = email.toLowerCase().trim()

  // 1) Arama uç noktası — birden çok test paralel koşarken doğru postayı seçer.
  const search = await readJson<{ messages?: MailpitSummary[] }>(
    request,
    `/api/v1/search?query=${encodeURIComponent(`to:${target}`)}&limit=10`,
  )
  const candidate = (search?.messages ?? []).find((message) =>
    addressesOf(message).includes(target),
  )
  if (candidate?.ID) {
    const detail = await readJson<MailpitDetail>(request, `/api/v1/message/${candidate.ID}`)
    if (detail) return toMessage(detail)
  }

  // 2) Yedek yol: Mailpit sürümünde arama yoksa "sonuncu"ya bakılır. Alıcı
  //    yine DOĞRULANIR; başka bir testin postasını okuyup yanlış hesabı
  //    onaylamak sessiz ve çok kötü bir hata olurdu.
  const latest = await readJson<MailpitDetail>(request, '/api/v1/message/latest')
  if (latest && addressesOf(latest).includes(target)) return toMessage(latest)

  return null
}

/** Adrese posta gelene kadar yoklar; süre dolarsa Türkçe hata fırlatır. */
export async function waitForMail(
  request: APIRequestContext,
  email: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<MailMessage> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null

  while (Date.now() < deadline) {
    try {
      const message = await findLatestFor(request, email)
      if (message) return message
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new Error(
    `Mailpit'te ${email} adresine gelen posta ${Math.round(timeoutMs / 1000)} saniyede bulunamadı. ` +
      `Yığın ayakta mı (docker compose -f docker/docker-compose.yml up -d) ve ` +
      `Mailpit ${MAILPIT_URL} adresinde mi? ` +
      (lastError ? `Son hata: ${String(lastError)}` : ''),
  )
}

/**
 * Postadaki ilk doğrulama bağlantısını çıkarır.
 *
 * Bağlantı Supabase'in `/auth/v1/verify?...&redirect_to=...` adresidir ve
 * tarayıcı onu uygulamanın `/auth/callback` yoluna yönlendirir; bu yüzden
 * kalıp değil, "postadaki bağlantı" izlenir.
 */
export function extractLink(message: MailMessage): string {
  const sources = [message.html, message.text]
  for (const source of sources) {
    if (!source) continue
    const decoded = source.replace(/&amp;/g, '&')
    const matches = decoded.match(/https?:\/\/[^\s"'<>)]+/g) ?? []
    const link = matches.find((value) => /token|verify|confirm|auth/i.test(value)) ?? matches[0]
    if (link) return link
  }

  throw new Error(
    `Doğrulama postasında bağlantı bulunamadı (konu: "${message.subject}"). ` +
      'E-posta şablonu değişmiş olabilir: supabase/templates/confirmation.html',
  )
}

/** Kayıt postasını bekler ve içindeki doğrulama bağlantısını döner. */
export async function waitForConfirmationLink(
  request: APIRequestContext,
  email: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return extractLink(await waitForMail(request, email, timeoutMs))
}
