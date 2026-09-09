/**
 * Basit sabit pencereli hız sınırlayıcı (şartname §10: "login 10/dk").
 *
 * SINIR — bilinçli ve belgelenmiş: sayaç SÜREÇ BELLEĞİNDE tutulur. Tek bir
 * uygulama örneği için doğru çalışır (docker compose kurulumu böyledir), ama
 * yatay ölçeklendiğinde her örnek kendi sayacını tutar ve gerçek sınır örnek
 * sayısıyla çarpılır.
 *
 * Bunun doğru çözümü paylaşılan bir sayaçtır (Redis, ya da Postgres'te
 * `INCR` benzeri bir RPC). MVP'de eklemedik çünkü yığına yeni bir servis
 * sokmak, tek örnekli bir kurulumda kazandırdığından fazlasını maliyet
 * olarak getiriyor. Çok örnekli üretime geçerken burası DEĞİŞMELİ.
 *
 * Not: Supabase GoTrue'nun kendi hız sınırı da vardır ve bu katman onun
 * yerine değil, ÖNÜNE konur — kötü niyetli istek kimlik servisine hiç
 * ulaşmadan kesilir.
 *
 * `server-only` işareti BİLEREK yok: modül saf mantıktır ve sır taşımaz,
 * böylece doğrudan test edilebilir. Sunucu sınırını çağıranlar uygular
 * (yalnızca Server Action'lardan çağrılır) — depodaki `activity/delta.ts`
 * ile aynı ayrım.
 */

type Bucket = {
  /** Pencerenin başlangıcı (epoch ms). */
  windowStart: number
  count: number
}

const buckets = new Map<string, Bucket>()

/** Bellek sızıntısını önlemek için ara sıra süresi geçmiş kovalar atılır. */
let lastSweep = 0
const SWEEP_INTERVAL_MS = 60_000

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= windowMs) buckets.delete(key)
  }
}

export type RateLimitResult = {
  allowed: boolean
  /** Pencerede kalan hak. */
  remaining: number
  /** Pencerenin sıfırlanmasına kalan saniye. */
  retryAfterSeconds: number
}

export type RateLimitOptions = {
  /** Sayaç anahtarı — genellikle `eylem:kimlik` (IP ya da e-posta). */
  key: string
  /** Pencere başına izin verilen istek sayısı. */
  limit: number
  /** Pencere uzunluğu (ms). */
  windowMs: number
  /** Test edilebilirlik için; üretimde verilmez. */
  now?: number
}

/**
 * Bir isteği sayar ve izin verilip verilmediğini döner.
 * Saf değildir (modül düzeyinde durum tutar) ama `now` parametresi sayesinde
 * test edilebilir: zamanı ileri sararak pencere sıfırlanması doğrulanabilir.
 */
export function consumeRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: RateLimitOptions): RateLimitResult {
  sweep(now, windowMs)

  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  bucket.count += 1

  const elapsed = now - bucket.windowStart
  const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000))

  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds }
}

/** Testler arası durumu temizler. Üretim kodundan çağrılmaz. */
export function resetRateLimits() {
  buckets.clear()
  lastSweep = 0
}

/** Şartname §10'daki sınırlar tek yerde. */
export const RATE_LIMITS = {
  /** Giriş denemesi: dakikada 10. */
  login: { limit: 10, windowMs: 60_000 },
  /** Şifre sıfırlama isteği: dakikada 5 — e-posta bombardımanını keser. */
  passwordReset: { limit: 5, windowMs: 60_000 },
  /** Kayıt: dakikada 5. */
  register: { limit: 5, windowMs: 60_000 },
} as const
