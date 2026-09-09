import { expect, test, type Page } from '@playwright/test'
import { ONBOARDING, TEST_PASSWORD, uniqueEmail } from './helpers/seed-facts'
import { waitForConfirmationLink } from './helpers/mail'

/**
 * E2E 1 — Kayıt → e-posta doğrulama → onboarding → seviye tespit → öncelikli konular
 * (spec §12, kabul ölçütü §M1).
 *
 * Test yeni ve BENZERSİZ bir e-posta ile kayıt olur; böylece yeniden
 * çalıştırıldığında "bu adres zaten kayıtlı" hatasına düşmez ve hiçbir tohum
 * hesabının durumunu değiştirmez.
 *
 * Yol boyunca iki kritik davranış ayrıca doğrulanır:
 *   · Doğrulanmamış hesap `/verify` sayfasında bekler (posta okunmadan geçilmez).
 *   · Sihirbaz YARIDA yenilenirse kaydedilmiş adımdan devam eder, 1. adımdan değil.
 */

/** Bugünden bir yıl sonrası — sihirbazın "geçmiş tarih" uyarısına düşmemek için. */
function nextYearDate(): string {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

async function continueWizard(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Devam et' }).click()
}

test('kayıt olan öğrenci onboarding ve seviye tespitini tamamlayınca öncelikli konularını görür', async ({
  page,
  request,
}) => {
  const email = uniqueEmail('ogrenci')

  await test.step('kayıt formu doldurulur ve KVKK onayı verilir', async () => {
    await page.goto('/register')
    await page.getByLabel('Ad Soyad').fill('E2E Deneme Öğrencisi')
    await page.getByLabel('E-posta').fill(email)
    await page.getByLabel('Şifre', { exact: true }).fill(TEST_PASSWORD)
    await page.getByLabel('Şifre (tekrar)').fill(TEST_PASSWORD)
    await page.getByRole('checkbox').first().check()
    await page.getByRole('button', { name: 'Kayıt ol' }).click()

    await expect(page).toHaveURL(/\/verify/)
    await expect(page.getByText(email)).toBeVisible()
  })

  await test.step('doğrulama postasındaki bağlantı izlenir', async () => {
    const link = await waitForConfirmationLink(request, email)
    await page.goto(link)
    // Doğrulanan ama başlangıç adımlarını bitirmemiş kullanıcı sihirbaza düşer.
    await expect(page).toHaveURL(/\/onboarding/)
  })

  await test.step('1. adım — rol (kayıtta öğrenci olarak belirlendi)', async () => {
    await expect(page.getByRole('heading', { name: 'Kim olarak katılıyorsunuz?' })).toBeVisible()
    await continueWizard(page)
  })

  await test.step('2. adım — hedef sınav', async () => {
    await expect(
      page.getByRole('heading', { name: 'Hangi sınava hazırlanıyorsunuz?' }),
    ).toBeVisible()
    await page.getByRole('radio', { name: ONBOARDING.examName }).click()
    await continueWizard(page)
    await expect(
      page.getByRole('heading', { name: 'Sınıfınız ya da durumunuz nedir?' }),
    ).toBeVisible()
  })

  await test.step('§M1 AC — yarıda yenilenen sihirbaz kaldığı adımdan devam eder', async () => {
    await page.reload()
    // 1. adıma DÖNMEZ: ilerleme sunucuda (`profiles.onboarding_step`) yaşıyor.
    await expect(
      page.getByRole('heading', { name: 'Sınıfınız ya da durumunuz nedir?' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kim olarak katılıyorsunuz?' })).toBeHidden()
    await expect(page.getByText('Kaldığınız yerden devam ediyorsunuz.')).toBeVisible()
  })

  await test.step('3. adım — sınıf', async () => {
    await page.getByRole('radio', { name: ONBOARDING.gradeLabel }).click()
    await continueWizard(page)
  })

  await test.step('4. adım — sınav tarihi', async () => {
    await expect(page.getByRole('heading', { name: 'Sınav tarihiniz ne zaman?' })).toBeVisible()
    await page.getByLabel('Sınav tarihi').fill(nextYearDate())
    await continueWizard(page)
  })

  await test.step('5. adım — çalışma bütçesi (varsayılanlar kabul edilir)', async () => {
    await expect(
      page.getByRole('heading', { name: 'Günde ne kadar çalışabilirsiniz?' }),
    ).toBeVisible()
    await continueWizard(page)
  })

  await test.step('6. adım — seviye tespit sınavı başlatılır', async () => {
    await expect(page.getByRole('heading', { name: 'Seviye tespit sınavı' })).toBeVisible()
    await page.getByRole('button', { name: 'Sınava başla' }).click()
    await expect(page).toHaveURL(/\/test\/[0-9a-f-]{36}/)
  })

  await test.step('birkaç soru cevaplanır ve sınav bitirilir', async () => {
    const options = page.locator('article button[aria-pressed]')
    await expect(options.first()).toBeVisible()

    // Havuz kısa olabilir (tohumda üç konunun soruları var); kaç soru varsa
    // en fazla üçü cevaplanır. Doğruluk önemli değil, ölçümün OLUŞMASI önemli.
    for (let index = 0; index < 3; index += 1) {
      const first = options.first()
      if (!(await first.isVisible())) break
      await first.click()
      await expect(first).toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: 'Sonraki soru' }).click()
    }

    await page.getByRole('button', { name: 'Testi bitir' }).click()
    await page.getByRole('button', { name: 'Evet, bitir' }).click()

    await expect(page).toHaveURL(/\/sonuc\/[0-9a-f-]{36}/)
    await expect(page.getByText('Net', { exact: true }).first()).toBeVisible()
  })

  await test.step('panelde öncelikli konular listelenir', async () => {
    await page.goto('/dashboard')

    const card = page.getByText('Öncelikli konular')
    await expect(card).toBeVisible()

    // Boş durum metni GÖRÜNMEMELİ: seviye tespit çözüldüğüne göre sıralama var.
    await expect(page.getByText('Henüz öncelik sıralaması yok.')).toBeHidden()
  })
})
