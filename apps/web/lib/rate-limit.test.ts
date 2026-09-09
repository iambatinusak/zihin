import { describe, it, expect, beforeEach } from 'vitest'
import { consumeRateLimit, resetRateLimits, RATE_LIMITS } from './rate-limit'

describe('hız sınırlayıcı', () => {
  beforeEach(() => resetRateLimits())

  const opts = (key: string, now: number) => ({ key, limit: 3, windowMs: 60_000, now })

  it('sınırın altındaki istekler geçer', () => {
    expect(consumeRateLimit(opts('a', 0)).allowed).toBe(true)
    expect(consumeRateLimit(opts('a', 100)).allowed).toBe(true)
    expect(consumeRateLimit(opts('a', 200)).allowed).toBe(true)
  })

  it('sınırı aşan istek reddedilir', () => {
    for (let i = 0; i < 3; i++) consumeRateLimit(opts('b', i))
    const fourth = consumeRateLimit(opts('b', 300))
    expect(fourth.allowed).toBe(false)
    expect(fourth.remaining).toBe(0)
  })

  it('kalan hak doğru sayılır', () => {
    expect(consumeRateLimit(opts('c', 0)).remaining).toBe(2)
    expect(consumeRateLimit(opts('c', 1)).remaining).toBe(1)
    expect(consumeRateLimit(opts('c', 2)).remaining).toBe(0)
  })

  it('pencere dolunca sayaç sıfırlanır', () => {
    for (let i = 0; i < 3; i++) consumeRateLimit(opts('d', i))
    expect(consumeRateLimit(opts('d', 500)).allowed).toBe(false)

    // Pencere sınırının bir milisaniye ötesi: yeni pencere.
    const afterWindow = consumeRateLimit(opts('d', 60_000))
    expect(afterWindow.allowed).toBe(true)
    expect(afterWindow.remaining).toBe(2)
  })

  it('pencere sınırının tam üstünde henüz sıfırlanmaz', () => {
    for (let i = 0; i < 3; i++) consumeRateLimit(opts('e', 0))
    // 59.999 ms hâlâ aynı pencere.
    expect(consumeRateLimit(opts('e', 59_999)).allowed).toBe(false)
  })

  it('farklı anahtarlar birbirini etkilemez', () => {
    for (let i = 0; i < 3; i++) consumeRateLimit(opts('f', i))
    expect(consumeRateLimit(opts('f', 10)).allowed).toBe(false)
    // Başka bir kullanıcı, dolu bir kovadan etkilenmemeli.
    expect(consumeRateLimit(opts('g', 10)).allowed).toBe(true)
  })

  it('retryAfterSeconds pencerenin kalanını verir', () => {
    for (let i = 0; i < 3; i++) consumeRateLimit(opts('h', 0))
    const blocked = consumeRateLimit(opts('h', 10_000))
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(50)
  })

  it('engellenen istek bile sayacı artırır — ısrar süreyi uzatmaz ama azaltmaz da', () => {
    for (let i = 0; i < 3; i++) consumeRateLimit(opts('i', 0))
    consumeRateLimit(opts('i', 1_000))
    // Pencere başlangıcı kaymaz: sıfırlanma hâlâ ilk isteğe göre.
    expect(consumeRateLimit(opts('i', 59_000)).retryAfterSeconds).toBe(1)
  })

  it('şartnamedeki giriş sınırı dakikada 10', () => {
    expect(RATE_LIMITS.login).toEqual({ limit: 10, windowMs: 60_000 })

    for (let i = 0; i < 10; i++) {
      expect(consumeRateLimit({ key: 'login:test', ...RATE_LIMITS.login, now: i }).allowed).toBe(
        true,
      )
    }
    expect(consumeRateLimit({ key: 'login:test', ...RATE_LIMITS.login, now: 11 }).allowed).toBe(
      false,
    )
  })
})
