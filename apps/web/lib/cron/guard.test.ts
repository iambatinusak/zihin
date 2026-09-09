import { describe, expect, it } from 'vitest'
import { guardCronRequest, isAuthorizedCronToken } from './guard'

const SECRET = 'dogru-cron-sirri-123'

describe('isAuthorizedCronToken', () => {
  it('doğru jetonu kabul eder', () => {
    expect(isAuthorizedCronToken(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it('aynı uzunlukta ama yanlış jetonu reddeder', () => {
    const wrong = 'dogru-cron-sirri-124'
    expect(wrong).toHaveLength(SECRET.length)
    expect(isAuthorizedCronToken(`Bearer ${wrong}`, SECRET)).toBe(false)
  })

  it('farklı uzunlukta jetonu timingSafeEqual fırlatmadan reddeder', () => {
    expect(isAuthorizedCronToken('Bearer kisa', SECRET)).toBe(false)
    expect(isAuthorizedCronToken(`Bearer ${SECRET}ekfazla`, SECRET)).toBe(false)
  })

  it('doğru jetonun ön eki bile olsa kabul etmez', () => {
    expect(isAuthorizedCronToken(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe(false)
  })

  it('başlık yoksa reddeder', () => {
    expect(isAuthorizedCronToken(null, SECRET)).toBe(false)
    expect(isAuthorizedCronToken(undefined, SECRET)).toBe(false)
  })

  it('Bearer öneki olmayan başlığı reddeder', () => {
    expect(isAuthorizedCronToken(SECRET, SECRET)).toBe(false)
    expect(isAuthorizedCronToken(`bearer ${SECRET}`, SECRET)).toBe(false)
    expect(isAuthorizedCronToken(`Basic ${SECRET}`, SECRET)).toBe(false)
  })

  it('sunucu sırrı tanımsız ya da boşsa hiçbir isteği kabul etmez', () => {
    expect(isAuthorizedCronToken('Bearer ', undefined)).toBe(false)
    expect(isAuthorizedCronToken('Bearer ', '')).toBe(false)
    expect(isAuthorizedCronToken('Bearer herhangi', null)).toBe(false)
  })
})

describe('guardCronRequest', () => {
  function request(headers: Record<string, string> = {}): Request {
    return new Request('https://ornek.test/api/cron/mastery-snapshot', { method: 'POST', headers })
  }

  it('yetkili istekte null döner — rota devam eder', () => {
    expect(guardCronRequest(request({ authorization: `Bearer ${SECRET}` }), SECRET)).toBeNull()
  })

  it('yetkisiz istekte 401 yanıtı döner', async () => {
    const response = guardCronRequest(request({ authorization: 'Bearer yanlis' }), SECRET)
    expect(response).not.toBeNull()
    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({ ok: false, error: 'unauthorized' })
  })

  it('başlık yokken 401 döner', () => {
    expect(guardCronRequest(request(), SECRET)?.status).toBe(401)
  })
})
