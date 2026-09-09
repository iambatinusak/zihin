import { expect, test } from '@playwright/test'
import { CONTENT, LGS_WRONG_PENALTY_DIVISOR, MIN_PERCENTILE_SAMPLE } from './helpers/seed-facts'
import { pageForRole } from './helpers/auth'

/**
 * E2E 3 — Editör içe aktarır → deneme kurar → öğrenci çözer → net/yüzdelik →
 * veli görür (spec §12).
 *
 * Üç rol, üç ayrı tarayıcı bağlamı: çerezler birbirini ezmesin.
 *
 * YÜZDELİK DİLİM BİLEREK "YETERLİ VERİ YOK" BEKLENİR. Dilim en az
 * 20 katılımcıyla hesaplanır; tek katılımcıyla bir sıralama göstermek
 * öğrenciyi yanıltırdı. Yani buradaki doğru davranış sayının çıkmaması ve
 * kapının çalıştığının görülmesidir.
 */

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const MOCK_TITLE = `E2E Deneme ${RUN_ID}`
const QUESTION_COUNT = 5

/** Testin kendi fikstürü: içe aktarılacak küçük CSV. */
function buildCsv(): string {
  const columns = [
    'stem',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'option_e',
    'correct',
    'explanation',
    'topic_slug',
    'difficulty',
    'expected_seconds',
  ]
  const correctKeys = ['A', 'B', 'C', 'D', 'A']

  const rows = correctKeys.map((correct, index) => [
    // Soru kökü her koşumda benzersiz: aynı dosya iki kez içeri alındığında
    // "yinelenen soru" denetimine takılmasın.
    `E2E ${RUN_ID} — ${index + 1}. deneme sorusu: aşağıdakilerden hangisi doğrudur?`,
    'Birinci seçenek',
    'İkinci seçenek',
    'Üçüncü seçenek',
    'Dördüncü seçenek',
    '',
    correct,
    'Bu soru uçtan uca test fikstürüdür; doğru şık içe aktarma dosyasında belirtilmiştir.',
    CONTENT.topicSlug,
    '2',
    '45',
  ])

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  return [columns.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
}

test('editörün içe aktardığı sorularla kurulan deneme öğrenci tarafından çözülür ve veliye yansır', async ({
  browser,
}) => {
  const editor = await pageForRole(browser, 'editor', { probePath: '/admin/sorular' })
  const student = await pageForRole(browser, 'student', { probePath: '/dashboard' })
  const parent = await pageForRole(browser, 'parent', { probePath: '/veli' })

  try {
    await test.step('editör CSV dosyasını toplu içe aktarır ve yayına alır', async () => {
      const page = editor.page
      await page.goto('/admin/sorular/ice-aktar')
      await expect(page.getByRole('heading', { name: 'Toplu soru içe aktarma' })).toBeVisible()

      await page.getByLabel('Dosya').setInputFiles({
        name: `e2e-sorular-${RUN_ID}.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(buildCsv(), 'utf-8'),
      })

      await page.getByRole('button', { name: 'Dosyayı denetle' }).click()
      // Kuru çalışma: hiçbir şey yazılmadan kaç satırın hazır olduğu söylenir.
      await expect(page.getByText(`${QUESTION_COUNT} satır içeri alınmaya hazır.`)).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Satır bazlı hata raporu' })).toBeHidden()

      // Deneme havuzu YALNIZCA yayımlanmış soruları görür; taslak kalırlarsa
      // deneme kurulamaz.
      await page.getByRole('switch', { name: 'Sorular doğrudan yayına alınsın' }).click()
      await page.getByRole('button', { name: 'İçe aktar' }).click()

      await expect(page.getByText(`${QUESTION_COUNT} soru içeri aktarıldı.`)).toBeVisible({
        timeout: 30_000,
      })
    })

    await test.step('editör bu sorularla bir deneme kurar ve yayımlar', async () => {
      const page = editor.page
      await page.goto('/admin/denemeler')
      await page.getByLabel('Sınav').selectOption({ label: CONTENT.examName })

      await expect(page.getByLabel('Deneme adı')).toBeVisible()
      await page.getByLabel('Deneme adı').fill(MOCK_TITLE)
      await page.getByLabel('Toplam süre (dakika)').fill('30')
      await page.getByLabel(CONTENT.subjectName, { exact: true }).fill(String(QUESTION_COUNT))

      await page.getByRole('switch', { name: 'Yayında' }).click()
      await page.getByRole('button', { name: 'Oluştur' }).click()

      // Kurulan deneme düzenleme ekranına götürür.
      await expect(page).toHaveURL(/\/admin\/testler\/[0-9a-f-]{36}/, { timeout: 30_000 })
    })

    await test.step('öğrenci denemeyi çözer', async () => {
      const page = student.page
      await page.goto('/deneme')

      const card = page.locator('li').filter({ hasText: MOCK_TITLE }).first()
      await expect(card).toBeVisible()
      await card.getByRole('button', { name: 'Denemeyi başlat' }).click()
      await expect(page).toHaveURL(/\/deneme\/[0-9a-f-]{36}/)

      const cells = page.getByRole('button', { name: /^\d+\. soru — / })
      const total = await cells.count()
      expect(total).toBe(QUESTION_COUNT)

      for (let index = 0; index < total; index += 1) {
        const option = page.locator('article button[aria-pressed]').first()
        await option.click()
        await expect(option).toHaveAttribute('aria-pressed', 'true')
        if (index < total - 1) {
          await page.getByRole('button', { name: 'Sonraki soru' }).click()
        }
      }

      await page.getByRole('button', { name: 'Testi bitir' }).click()
      await page.getByRole('button', { name: 'Evet, bitir' }).click()
      await expect(page).toHaveURL(/\/deneme\/sonuc\/[0-9a-f-]{36}/)
    })

    await test.step('sonuçta ders bazlı net ve net formülü doğrulanır', async () => {
      const page = student.page
      await expect(page.getByRole('heading', { name: 'Ders bazlı sonuç' })).toBeVisible()

      const subjectRow = page.getByRole('row').filter({ hasText: CONTENT.subjectName }).first()
      await expect(subjectRow).toBeVisible()

      const totalRow = page.getByRole('row').filter({ hasText: 'Genel' }).first()
      const values = await totalRow.getByRole('cell').allInnerTexts()
      // Sütunlar: Ders · Soru · Doğru · Yanlış · Boş · Net
      const [, totalText, correctText, wrongText, blankText, netText] = values
      const totalQuestions = Number(totalText)
      const correct = Number(correctText)
      const wrong = Number(wrongText)
      const blank = Number(blankText)
      const net = Number(netText?.replace(',', '.'))

      expect(totalQuestions).toBe(QUESTION_COUNT)
      expect(correct + wrong + blank).toBe(totalQuestions)
      // LGS'de üç yanlış bir doğruyu götürür.
      expect(net).toBeCloseTo(correct - wrong / LGS_WRONG_PENALTY_DIVISOR, 2)
    })

    await test.step('tek katılımcıyla yüzdelik dilim açılmaz', async () => {
      const page = student.page
      await expect(page.getByText('Yeterli veri yok')).toBeVisible()
      await expect(page.getByText(new RegExp(`en az ${MIN_PERCENTILE_SAMPLE} kişi`))).toBeVisible()
    })

    await test.step('veli panelinde deneme sonucu görünür', async () => {
      const page = parent.page
      await page.goto('/veli')

      const mocks = page.locator('section').filter({ hasText: MOCK_TITLE }).first()
      // "Son denemeler" bir kart başlığıdır (başlık öğesi değil).
      await expect(page.getByText('Son denemeler')).toBeVisible()
      await expect(mocks).toBeVisible({ timeout: 30_000 })
      await expect(mocks).toContainText('net')
      // Veli içeriğe geçemez: sonuç ekranına bağlantı YOKTUR (spec §M12).
      await expect(page.getByRole('link', { name: /Sonucu gör/ })).toHaveCount(0)
    })
  } finally {
    await editor.context.close()
    await student.context.close()
    await parent.context.close()
  }
})
