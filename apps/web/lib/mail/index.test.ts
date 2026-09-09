import { describe, expect, it, vi } from 'vitest'
import {
  getEmailProvider,
  resolveEmailProviderName,
  sendEmailBatchQuietly,
  sendEmailQuietly,
} from './index'
import { createLogEmailProvider } from './log-provider'
import type { EmailMessage, EmailProvider } from './provider'

const MESSAGE: EmailMessage = {
  to: 'ogrenci@ornek.test',
  subject: 'Konu',
  html: '<p>Merhaba</p>',
  text: 'Merhaba',
}

describe('resolveEmailProviderName', () => {
  it('anahtar yoksa log sağlayıcısını seçer', () => {
    expect(resolveEmailProviderName(undefined)).toBe('log')
    expect(resolveEmailProviderName(null)).toBe('log')
    expect(resolveEmailProviderName('')).toBe('log')
    // Yalnızca boşluktan oluşan bir değer "yapılandırılmış" sayılmaz.
    expect(resolveEmailProviderName('   ')).toBe('log')
  })

  it('anahtar varsa Resend seçilir', () => {
    expect(resolveEmailProviderName('re_123')).toBe('resend')
  })
})

describe('getEmailProvider', () => {
  it('açıkça istenen sağlayıcıyı kurar', () => {
    expect(getEmailProvider('log').name).toBe('log')
    expect(getEmailProvider('resend').name).toBe('resend')
  })

  it('ortamda anahtar yokken log sağlayıcısına düşer', () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect(getEmailProvider().name).toBe('log')
    vi.unstubAllEnvs()
  })
})

describe('log sağlayıcısı', () => {
  it('gövdeyi konsola basar ve göndermez', async () => {
    const info = vi.fn()
    const result = await createLogEmailProvider({ info }).send(MESSAGE)

    expect(result).toEqual({ provider: 'log', id: null })
    expect(info).toHaveBeenCalledOnce()
    const printed = String(info.mock.calls[0]?.[0])
    expect(printed).toContain('ogrenci@ornek.test')
    expect(printed).toContain('Konu')
    // Düz metin dalı da basılır: metin gövdesinin boş kaldığı böyle görülür.
    expect(printed).toContain('Merhaba')
  })
})

describe('sendEmailQuietly', () => {
  it('sağlayıcı patlarsa çağıranı kırmaz', async () => {
    const provider: EmailProvider = {
      name: 'resend',
      send: vi.fn().mockRejectedValue(new Error('Resend 503')),
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendEmailQuietly(MESSAGE, provider)).resolves.toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('adres boşsa sağlayıcıya hiç gitmez', async () => {
    const send = vi.fn()
    const provider: EmailProvider = { name: 'log', send }

    await expect(sendEmailQuietly({ ...MESSAGE, to: '  ' }, provider)).resolves.toBeNull()
    expect(send).not.toHaveBeenCalled()
  })
})

describe('sendEmailBatchQuietly', () => {
  it('bir alıcıdaki hata kalan alıcıları düşürmez', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ provider: 'resend', id: '1' })
      .mockRejectedValueOnce(new Error('kota'))
      .mockResolvedValueOnce({ provider: 'resend', id: '3' })
    const provider: EmailProvider = { name: 'resend', send }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const sent = await sendEmailBatchQuietly(
      [
        { ...MESSAGE, to: 'a@ornek.test' },
        { ...MESSAGE, to: 'b@ornek.test' },
        { ...MESSAGE, to: 'c@ornek.test' },
      ],
      provider,
    )

    expect(sent).toBe(2)
    expect(send).toHaveBeenCalledTimes(3)
    spy.mockRestore()
  })
})
