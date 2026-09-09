import { timingSafeEqual } from 'node:crypto'

/**
 * `/api/cron/*` uçlarının paylaşılan kapısı.
 *
 * Beklenen başlık: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Karşılaştırma SABİT ZAMANLIDIR. Düz `===` ilk farklı bayta kadar çalışıp
 * durur; saldırgan yanıt sürelerini ölçerek sırrı bayt bayt kurtarabilir.
 * `timingSafeEqual` eşit uzunlukta tampon ister, bu yüzden uzunluk önce ayrıca
 * denetlenir (uzunluk zaten sızdırılabilir bir bilgi, sırrın kendisi değil).
 *
 * Kullanım (rota tarafı):
 *   const denied = guardCronRequest(request)
 *   if (denied) return denied
 */

/** Sunucu sırrı tanımlı değilse hiçbir istek kabul edilmez. */
export function isAuthorizedCronToken(
  headerValue: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (typeof secret !== 'string' || secret.length === 0) return false
  if (typeof headerValue !== 'string') return false

  const prefix = 'Bearer '
  if (!headerValue.startsWith(prefix)) return false

  const token = headerValue.slice(prefix.length)
  const tokenBuffer = Buffer.from(token, 'utf8')
  const secretBuffer = Buffer.from(secret, 'utf8')

  // Uzunluk farkında timingSafeEqual fırlatır; erken ve açıkça eleriz.
  if (tokenBuffer.length !== secretBuffer.length) return false

  return timingSafeEqual(tokenBuffer, secretBuffer)
}

/**
 * İsteği denetler. Yetkiliyse `null` döner (rota devam eder); değilse
 * doğrudan döndürülecek 401 yanıtını verir.
 *
 * Gövde bilinçli olarak sade: yetkisiz çağırana hangi denetimin patladığı
 * söylenmez.
 */
export function guardCronRequest(
  request: Request,
  secret = process.env.CRON_SECRET,
): Response | null {
  if (isAuthorizedCronToken(request.headers.get('authorization'), secret)) return null

  return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })
}
