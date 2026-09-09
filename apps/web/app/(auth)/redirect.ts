/**
 * Giriş sonrası yönlendirme hedefinin güvenliği.
 *
 * `?next=` parametresi kullanıcıdan gelir; doğrudan `redirect()`e verilirse
 * açık yönlendirme (open redirect) açığı oluşur: saldırgan kurbanı kendi
 * sitesine taşıyıp sahte bir giriş ekranı gösterebilir. Bu yüzden yalnızca
 * **aynı origin içinde kalan, tek eğik çizgiyle başlayan** yollar kabul edilir.
 *
 * Değer ham hâliyle DE, yüzde çözümlenmiş hâliyle DE denetlenir: `/%2f%2fevil.com`
 * ya da `/%5cevil.com` bazı proxy/CDN katmanlarında Location başlığına
 * yazılmadan önce normalleştirilir ve tekrar protokol-göreli bir URL'e döner.
 */

/** Ham değerde boşluk da yasak; çözümlenmiş değerde `%20` meşru olabilir. */
const CONTROL_STRICT = /[\u0000-\u0020\u007f\u2028\u2029]/
const CONTROL_DECODED = /[\u0000-\u001f\u007f\u2028\u2029]/

/**
 * Kabul edilmeyen desenler; hem ham hem çözümlenmiş değere uygulanır.
 * `allowSpace` yalnızca çözümlenmiş değer için açılır (`/konu%20adi` meşrudur).
 */
function looksHostile(value: string, allowSpace = false): boolean {
  if (!value.startsWith('/')) return true
  // '//host' protokol-göreli mutlak URL'dir.
  if (value.startsWith('//')) return true
  // '/\evil.com' bazı tarayıcılarda '//evil.com' gibi çözümlenir.
  if (value.includes('\\')) return true
  // Denetim karakterleri (CR/LF dâhil) başlık enjeksiyonu taşıyabilir.
  if ((allowSpace ? CONTROL_DECODED : CONTROL_STRICT).test(value)) return true
  // İlk yol parçasında şema/kimlik ayracı: '/javascript:...', '/user:pass@host'.
  if (/^\/[^/]*:/.test(value)) return true
  return false
}

/**
 * `decodeURIComponent` bozuk yüzde dizilerinde patlar; bozuk girdi zaten
 * reddedilmeli, bu yüzden hata "güvensiz" sayılır.
 */
function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

/** Yalnızca uygulama içi mutlak yollar güvenlidir. */
export function isSafeRedirect(path: string | null | undefined): boolean {
  if (typeof path !== 'string') return false
  if (path.length === 0) return false

  if (looksHostile(path)) return false

  // Yüzde kodlaması iki tur çözülür: '%252f' gibi çift kodlamalar da elenir.
  let current = path
  for (let round = 0; round < 2; round += 1) {
    const decoded = decodeOnce(current)
    if (decoded === null) return false
    if (decoded === current) break
    if (looksHostile(decoded, true)) return false
    current = decoded
  }

  return true
}

/** Güvenliyse `next`i, değilse verilen varsayılanı döner. */
export function safeRedirectOr(path: string | null | undefined, fallback: string): string {
  return isSafeRedirect(path) ? (path as string) : fallback
}
