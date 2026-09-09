import { defineConfig, devices } from '@playwright/test'

/**
 * Uçtan uca koşum yapılandırması (spec §12).
 *
 * UYGULAMA BURADAN BAŞLATILMAZ. `webServer` bilerek tanımlı değildir: yığın
 * (Next.js + Supabase + Postgres + Mailpit) docker compose ile ayağa kalkar ve
 * seed tek seferlik `migrate` servisiyle uygulanır. Playwright'ın ikinci bir
 * `next dev` başlatması, testlerin veritabanı olmayan bir uygulamaya bakmasına
 * yol açardı. Adres kapalıysa `e2e/global-setup.ts` erken ve Türkçe uyarır.
 *
 * TEK İŞÇİ: iki spec aynı tohum hesabını (`ogrenci@test.com`) kullanır. Paralel
 * koşarlarsa aynı hesapta iki test oturumu açılır ve "yarım kalan oturuma
 * devam" kuralı testleri birbirine karıştırır. Bağımsızlık burada sıradan
 * değil, sıralı koşumla korunur.
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:14000'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',

  // Kayıt + posta doğrulama + 6 adımlı sihirbaz tek testte akıyor; cömert ama
  // sonsuz olmayan bir üst sınır gerekiyor.
  timeout: 3 * 60 * 1000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
