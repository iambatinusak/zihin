import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Şablon testleri.
 *
 * Marka adı ve adres MODÜL YÜKLENİRKEN okunuyor (`lib/env.ts` içindeki
 * `APP_NAME` / `APP_URL` sabitleri), bu yüzden her test ortamı kurup modülü
 * yeniden içe aktarır. Böylece "marka nötr" iddiası gerçekten sınanır: sabit
 * bir isim gömülmüş olsaydı bu testler yakalamazdı.
 */

const APP_NAME = 'Testfabrika'
const APP_URL = 'https://ornek.test'

type Templates = typeof import('./templates')

async function loadTemplates(): Promise<Templates> {
  vi.resetModules()
  process.env.NEXT_PUBLIC_APP_NAME = APP_NAME
  process.env.NEXT_PUBLIC_APP_URL = APP_URL
  return import('./templates')
}

const originalName = process.env.NEXT_PUBLIC_APP_NAME
const originalUrl = process.env.NEXT_PUBLIC_APP_URL

let templates: Templates

beforeEach(async () => {
  templates = await loadTemplates()
})

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_NAME = originalName
  process.env.NEXT_PUBLIC_APP_URL = originalUrl
  vi.resetModules()
})

/** Her şablonun geçmesi gereken ortak sözleşme. */
function expectWellFormed(rendered: { subject: string; html: string; text: string }) {
  expect(rendered.subject.trim()).not.toBe('')
  expect(rendered.html).toContain('<!doctype html>')
  expect(rendered.text.trim()).not.toBe('')

  // Marka adı iki dalda da geçer.
  expect(rendered.html).toContain(APP_NAME)
  expect(rendered.text).toContain(APP_NAME)

  // Tercih satırı her şablonun sonunda ve /ayarlar'ı gösteriyor.
  expect(rendered.html).toContain(`${APP_URL}/ayarlar`)
  expect(rendered.text).toContain(`${APP_URL}/ayarlar`)

  // Doldurulmamış yer tutucu kalmamalı.
  for (const body of [rendered.subject, rendered.html, rendered.text]) {
    expect(body).not.toMatch(/\{[a-zA-Z_]+\}/)
    expect(body).not.toContain('undefined')
    expect(body).not.toContain('NaN')
    expect(body).not.toContain('[object Object]')
  }

  // Varsayılan marka adı hiçbir şablona gömülmemeli.
  expect(rendered.html).not.toContain('Zihin')
  expect(rendered.text).not.toContain('Zihin')
}

describe('e-posta şablonları', () => {
  it('doğrulama e-postası bağlantıyı ve marka adını taşır', () => {
    const rendered = templates.verificationEmail({
      name: 'Ayşe',
      verifyUrl: 'https://ornek.test/auth/dogrula?token=abc',
    })

    expectWellFormed(rendered)
    expect(rendered.subject).toContain(APP_NAME)
    expect(rendered.html).toContain('https://ornek.test/auth/dogrula?token=abc')
    expect(rendered.text).toContain('https://ornek.test/auth/dogrula?token=abc')
    expect(rendered.text).toContain('Merhaba Ayşe,')
  })

  it('şifre sıfırlama e-postası sıfırlama adresini taşır', () => {
    const rendered = templates.passwordResetEmail({
      resetUrl: 'https://ornek.test/sifre-sifirla?token=xyz',
    })

    expectWellFormed(rendered)
    // Ad yoksa kişiselleştirilmeden selamlanır.
    expect(rendered.text).toContain('Merhaba,')
    expect(rendered.html).toContain('https://ornek.test/sifre-sifirla?token=xyz')
  })

  it('tekrar hatırlatması kart sayısını konuya ve gövdeye yazar', () => {
    const rendered = templates.reviewReminderEmail({ name: 'Mert', dueCount: 14 })

    expectWellFormed(rendered)
    expect(rendered.subject).toContain('14')
    expect(rendered.text).toContain('14 hafıza kartınız')
    expect(rendered.text).toContain(`${APP_URL}/kartlar`)
  })

  it('program hatırlatması gün etiketini ve blok sayısını kullanır', () => {
    const rendered = templates.planReminderEmail({
      name: 'Deniz',
      pendingBlocks: 3,
      dayLabel: '9 Eylül Salı',
      minutes: 90,
    })

    expectWellFormed(rendered)
    expect(rendered.subject).toContain('3')
    expect(rendered.text).toContain('9 Eylül Salı')
    expect(rendered.text).toContain('90 dakika')
    expect(rendered.text).toContain(`${APP_URL}/program`)
  })

  it('program hatırlatması dakika verilmediğinde süreden söz etmez', () => {
    const rendered = templates.planReminderEmail({
      pendingBlocks: 1,
      dayLabel: '9 Eylül Salı',
    })

    expectWellFormed(rendered)
    expect(rendered.text).not.toContain('dakika sürüyor')
  })

  it('soru yanıtlandı e-postası soruya giden bağlantıyı kurar', () => {
    const rendered = templates.questionAnsweredEmail({
      name: 'Elif',
      subjectName: 'Matematik',
      requestId: '11111111-2222-3333-4444-555555555555',
    })

    expectWellFormed(rendered)
    expect(rendered.subject).toContain('Matematik')
    expect(rendered.text).toContain(`${APP_URL}/soru-sor/11111111-2222-3333-4444-555555555555`)
  })

  it('ders adı yoksa soru yanıtlandı e-postası genel konuya düşer', () => {
    const rendered = templates.questionAnsweredEmail({ requestId: 'abc', subjectName: '  ' })

    expectWellFormed(rendered)
    expect(rendered.subject).toBe('Sorunuz yanıtlandı')
  })

  it('veli haftalık özeti bütün sayıları listeler', () => {
    const rendered = templates.parentWeeklySummaryEmail({
      parentName: 'Hakan Bey',
      studentName: 'Zeynep',
      weekLabel: '1 – 7 Eylül',
      studyMinutes: 320,
      questionsAnswered: 145,
      videosCompleted: 9,
      accuracyPercent: 78,
      reportPath: '/veli/raporlar?ogrenci=abc',
    })

    expectWellFormed(rendered)
    expect(rendered.subject).toContain('Zeynep')
    expect(rendered.subject).toContain('1 – 7 Eylül')
    expect(rendered.text).toContain('320 dakika')
    expect(rendered.text).toContain('145')
    expect(rendered.text).toContain('%78')
    expect(rendered.text).toContain(`${APP_URL}/veli/raporlar?ogrenci=abc`)
  })

  it('doğruluk ölçülmediğinde %0 yazmaz', () => {
    const rendered = templates.parentWeeklySummaryEmail({
      weekLabel: '1 – 7 Eylül',
      studyMinutes: 0,
      questionsAnswered: 0,
      videosCompleted: 0,
      accuracyPercent: null,
      reportPath: '/veli/raporlar',
    })

    expectWellFormed(rendered)
    expect(rendered.text).toContain('ölçülmedi')
    expect(rendered.text).not.toContain('%0')
    // Öğrenci adı bilinmiyorsa nötr karşılık kullanılır.
    expect(rendered.subject).toContain('Öğrenciniz')
  })

  it('abonelik bitiyor e-postası kalan günü ve tarihi yazar', () => {
    const rendered = templates.subscriptionEndingEmail({
      name: 'Can',
      packageName: 'Yıllık Paket',
      daysLeft: 7,
      endsAtLabel: '16 Eylül 2026',
    })

    expectWellFormed(rendered)
    expect(rendered.subject).toContain('7 gün')
    expect(rendered.text).toContain('16 Eylül 2026')
    expect(rendered.text).toContain(`${APP_URL}/ayarlar`)
  })

  it('son gün için ayrı bir konu kullanılır', () => {
    const rendered = templates.subscriptionEndingEmail({
      packageName: 'Aylık Paket',
      daysLeft: 0,
      endsAtLabel: '9 Eylül 2026',
    })

    expectWellFormed(rendered)
    expect(rendered.subject).toContain('bugün sona eriyor')
  })

  it('kullanıcı adındaki HTML kaçırılır, düz metinde olduğu gibi kalır', () => {
    const rendered = templates.reviewReminderEmail({
      name: '<script>alert(1)</script>',
      dueCount: 2,
    })

    expect(rendered.html).not.toContain('<script>')
    expect(rendered.html).toContain('&lt;script&gt;')
    expect(rendered.text).toContain('<script>alert(1)</script>')
  })

  it('negatif ya da kesirli sayılar gövdeye sızmaz', () => {
    const rendered = templates.reviewReminderEmail({ dueCount: -4.7 })
    expect(rendered.subject).toContain('0 hafıza')
    expect(rendered.subject).not.toContain('-')
  })
})
