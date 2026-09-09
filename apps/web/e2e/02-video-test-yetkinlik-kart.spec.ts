import { expect, test, type Locator, type Page } from '@playwright/test'
import { CONTENT } from './helpers/seed-facts'
import { pageForRole } from './helpers/auth'

/**
 * E2E 2 — Video → checkpoint → test → sonuç → yetkinlik → kart tekrarı (spec §12).
 *
 * Yolculuk iki teste bölünmüştür ve bunun tek bir sebebi var: VİDEO KAYNAĞI.
 * Tohumdaki `videos.storage_path` gerçek bir dosyaya işaret etmeyen bir yer
 * tutucudur; depoya video yüklenmemiş bir kurulumda oynatıcı hiç veri
 * alamaz. Checkpoint mekanizması ancak GERÇEK oynatma sırasında (`timeupdate`)
 * tetiklendiği için o kısım oynatılabilir kaynak yoksa `test.skip` ile
 * atlanır — "hiçbir şey bulamadığı için sessizce geçen" bir test, atlanmış
 * bir testten daha kötüdür. Zincirin geri kalanı (test → sonuç → yetkinlik →
 * kart) videodan bağımsızdır ve her koşumda gerçekten çalışır.
 */

const TOPIC_PATH = `/dersler/${CONTENT.subjectSlug}/${CONTENT.unitSlug}/${CONTENT.topicSlug}`

/** /dersler'den başlayıp içeriği olan konuya GEZİNEREK gider (kimlik varsaymaz). */
async function navigateToContentTopic(page: Page): Promise<void> {
  await page.goto('/dersler')
  await page.getByRole('link', { name: CONTENT.subjectName, exact: true }).first().click()

  const topicLink = page.getByRole('link', { name: new RegExp(escapeRegExp(CONTENT.topicTitle)) })
  if ((await topicLink.count()) === 0) {
    // Ünite akordiyonu kapalıysa önce açılır (ilk ünite varsayılan olarak açık).
    await page.getByRole('button', { name: new RegExp(escapeRegExp(CONTENT.unitName)) }).click()
  }
  await topicLink.first().click()

  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(TOPIC_PATH)}$`))
  await expect(page.getByRole('heading', { name: CONTENT.topicTitle })).toBeVisible()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Bir özet kartının değeri: `<dt>Yanlış</dt><dd>3</dd>`. */
async function summaryValue(page: Page, label: string): Promise<number> {
  const value = await page
    .locator('dt')
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`) })
    .first()
    .locator('xpath=following-sibling::dd[1]')
    .innerText()
  return Number(value.trim().replace(',', '.'))
}

/**
 * Oynatıcının gerçekten veri alıp alamadığını sorar.
 * `canplay` gelirse oynatılabilir; `error` ya da zaman aşımı gelirse değil.
 */
async function isPlayable(video: Locator, timeoutMs = 8000): Promise<boolean> {
  return video.evaluate(
    (element, timeout) =>
      new Promise<boolean>((resolve) => {
        const media = element as HTMLVideoElement
        if (media.error) return resolve(false)
        if (media.readyState >= 2) return resolve(true)

        const done = (value: boolean) => {
          media.removeEventListener('canplay', onCanPlay)
          media.removeEventListener('error', onError)
          resolve(value)
        }
        const onCanPlay = () => done(true)
        const onError = () => done(false)

        media.addEventListener('canplay', onCanPlay)
        media.addEventListener('error', onError)
        media.load()
        window.setTimeout(() => done(media.readyState >= 2), timeout)
      }),
    timeoutMs,
  )
}

test.describe('içeriği olan konu: video, test, yetkinlik ve kartlar', () => {
  test('video oynatıcısı checkpoint sorusunu açar ve cevap kaydedilir', async ({ browser }) => {
    const { context, page } = await pageForRole(browser, 'student', { probePath: '/dashboard' })

    try {
      await navigateToContentTopic(page)

      const videoLink = page.getByRole('link', { name: /Konu Anlatımı/ })
      const hasVideo = (await videoLink.count()) > 0
      test.skip(
        !hasVideo,
        `"${CONTENT.topicTitle}" konusunda oynatılabilir video satırı yok (tohumda video eksik ya da kilitli).`,
      )
      await videoLink.first().click()
      await expect(page).toHaveURL(/\/video\/[0-9a-f-]{36}/)

      // Oynatıcı hiç kurulamadıysa (imzalı bağlantı üretilemedi) sayfa
      // "Video şu anda oynatılamıyor" der; kontrol edilecek bir makine yok.
      const player = page.getByRole('group', { name: 'Video oynatıcı' })
      test.skip(
        (await player.count()) === 0,
        'Oynatıcı kurulamadı (imzalı bağlantı yok ya da video abonelik gerektiriyor); checkpoint mekanizması denenemez.',
      )
      await expect(player).toBeVisible()

      const video = page.locator('video')
      const playable = await isPlayable(video)
      test.skip(
        !playable,
        'Video kaynağı oynatılamıyor (tohumdaki storage_path bir yer tutucudur; depoya dosya yüklenmemiş). ' +
          'Checkpoint yalnızca gerçek oynatma sırasında tetiklenir.',
      )

      // Checkpoint anları ilerleme çubuğundaki işaretlerden okunur; saniye
      // değeri teste gömülmez ("8 dakika 40 saniye" → 520).
      const tickLabel = await page
        .locator('span', { hasText: /anında kontrol sorusu var/ })
        .first()
        .innerText()
      const minutes = Number(/(\d+)\s*dakika/.exec(tickLabel)?.[1] ?? 0)
      const seconds = Number(/(\d+)\s*saniye/.exec(tickLabel)?.[1] ?? 0)
      const checkpointAt = minutes * 60 + seconds
      expect(checkpointAt).toBeGreaterThan(0)

      // Checkpoint'in HEMEN öncesine konumlanıp oynatılır: tetikleyici
      // `timeupdate` sırasında geçilen an olduğu için ileri sarmak yetmez.
      await video.evaluate((element, at) => {
        const media = element as HTMLVideoElement
        media.muted = true
        media.currentTime = Math.max(0, at - 2)
        void media.play()
      }, checkpointAt)

      const overlay = page.getByRole('dialog', { name: 'Kontrol sorusu' })
      await expect(overlay).toBeVisible({ timeout: 30_000 })

      // Video duraklatılmış olmalı: soru cevaplanmadan devam edilmez.
      await expect
        .poll(async () => video.evaluate((element) => (element as HTMLVideoElement).paused))
        .toBe(true)

      await overlay.getByRole('radio').first().check()
      await overlay.getByRole('button', { name: 'Cevapla' }).click()

      // Doğru ya da yanlış — ikisi de geçerli sonuç; ölçülen, cevabın
      // sunucuda değerlendirilip geri dönmesi.
      await expect(overlay.getByText(/Doğru cevap\.|Yanlış cevap\./)).toBeVisible()
      await overlay.getByRole('button', { name: 'Videoya devam et' }).click()
      await expect(overlay).toBeHidden()
    } finally {
      await context.close()
    }
  })

  test('konu testi çözülür, sonuç açıklamalarıyla görünür, yetkinlik ve kartlar güncellenir', async ({
    browser,
  }) => {
    const { context, page } = await pageForRole(browser, 'student', { probePath: '/dashboard' })

    try {
      await navigateToContentTopic(page)

      await test.step('konu testi başlatılır', async () => {
        await page.getByRole('tab', { name: 'Testler' }).click()
        await page
          .getByRole('button', { name: new RegExp(escapeRegExp('Konu Testi')) })
          .first()
          .click()
        await expect(page).toHaveURL(/\/test\/[0-9a-f-]{36}/)
      })

      await test.step('tüm sorular cevaplanır ve test bitirilir', async () => {
        // Izgaradaki hücre sayısı = sorudaki soru sayısı.
        const cells = page.getByRole('button', { name: /^\d+\. soru — / })
        const total = await cells.count()
        expect(total).toBeGreaterThan(0)

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
        await expect(page).toHaveURL(/\/sonuc\/[0-9a-f-]{36}/)
      })

      const wrongCount =
        await test.step('sonuç ekranı cevapları ve açıklamaları gösterir', async () => {
          await expect(page.getByRole('heading', { name: 'Soru çözümleri' })).toBeVisible()
          await expect(page.getByText('Doğru cevap').first()).toBeVisible()
          await expect(page.getByText('Açıklama').first()).toBeVisible()

          const wrong = await summaryValue(page, 'Yanlış')
          const correct = await summaryValue(page, 'Doğru')
          const blank = await summaryValue(page, 'Boş')
          expect(correct + wrong + blank).toBeGreaterThan(0)
          return wrong
        })

      await test.step('yanlışlardan hafıza kartı üretilir', async () => {
        if (wrongCount === 0) {
          // Şıkkın hepsi doğru geldiyse üretilecek kart yok; bu bir arıza
          // değil, o koşumun sonucu. Adım burada dürüstçe biter.
          test.info().annotations.push({
            type: 'not-applicable',
            description: 'Bu koşumda yanlış cevap çıkmadı; kart üretimi denenemedi.',
          })
          return
        }
        // Kartlar `finishTest` sırasında zaten üretilir; düğme yalnızca eksik
        // kalanı ekler ("yeni kart yok" demesi de doğru bir sonuçtur).
        await page.getByRole('button', { name: /Yanlışlarımı karta ekle/ }).click()

        await page.goto(`/kartlar?konu=${CONTENT.topicSlug}`)
        await expect(
          page.getByRole('heading', { name: 'Yanlışlarımdan üretilenler' }),
        ).toBeVisible()
        await expect(page.getByText('Bu konuda otomatik üretilmiş kartınız yok.')).toBeHidden()
      })

      await test.step('panelde konunun yetkinliği görünür', async () => {
        await page.goto('/panel')
        await expect(page.getByRole('heading', { name: 'Akıllı Test Paneli' })).toBeVisible()

        // Ders sekmesi varsa doğru derse geçilir; ısı haritası ders ders açılır.
        const subjectTab = page.getByRole('tab', { name: CONTENT.subjectName })
        if ((await subjectTab.count()) > 0) await subjectTab.first().click()

        const cell = page
          .getByRole('link', { name: new RegExp(escapeRegExp(CONTENT.topicTitle)) })
          .first()
        await expect(cell).toBeVisible()
        // Hücre metni durum + puandır; "Ölçülmedi" ise yetkinlik yazılmamış demektir.
        await expect(cell).toContainText(/Zayıf|Orta|Güçlü/)
      })

      await test.step('kart tekrar sırası bir kart puanlanınca ilerler', async () => {
        await page.goto('/kartlar')

        const progress = page.getByText(/^\d+ \/ \d+$/).first()
        await expect(page.getByRole('heading', { name: 'Bugün Tekrar' })).toBeVisible()
        const before = (await progress.innerText()).trim()

        await page.getByRole('button', { name: 'Çevir' }).click()
        await page.getByRole('button', { name: /^İyi/ }).click()

        // Ya sıradaki karta geçilir ya da deste biter; ikisi de "ilerledi"dir.
        await expect
          .poll(async () => {
            if (await page.getByText('Bugünün destesi bitti').isVisible()) return 'bitti'
            return (await progress.innerText()).trim()
          })
          .not.toBe(before)
      })
    } finally {
      await context.close()
    }
  })
})
