import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ACCOUNTS, TEST_PASSWORD, type AccountRole } from './seed-facts'

/**
 * Oturum yardımcıları.
 *
 * `signIn` GERÇEK giriş formunu kullanır — giriş akışının kendisi de
 * denenmiş olsun diye çerez enjekte edilmez. Tekrar tekrar giriş yapmamak
 * için oturum durumu diske yazılır ve sonraki koşumlarda yeniden kullanılır;
 * durum bayatlamışsa (çerez süresi dolmuş, tohum yeniden kurulmuş) sessizce
 * yeniden giriş yapılır.
 */

const STATE_DIR = path.join(__dirname, '..', '.auth')
/** Kaydedilmiş oturumun en fazla ömrü; ötesinde baştan giriş yapılır. */
const STATE_MAX_AGE_MS = 30 * 60 * 1000

function statePath(email: string): string {
  return path.join(STATE_DIR, `${email.replace(/[^a-z0-9]+/gi, '-')}.json`)
}

function isFresh(file: string): boolean {
  if (!existsSync(file)) return false
  try {
    return Date.now() - statSync(file).mtimeMs < STATE_MAX_AGE_MS
  } catch {
    return false
  }
}

/** Giriş formunu doldurur ve yönlendirmenin tamamlanmasını bekler. */
export async function signIn(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Giriş yap' }).click()

  // Rolüne göre farklı bir sayfaya düşer; ortak koşul "artık /login'de değil".
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })
}

/** Sayfanın oturumlu olup olmadığını, korumalı bir yola giderek anlar. */
export async function isSignedIn(page: Page, probePath: string): Promise<boolean> {
  await page.goto(probePath)
  return !/\/login/.test(new URL(page.url()).pathname)
}

type RoleContextOptions = {
  /** Oturumun canlı olduğunu doğrulamak için gidilecek korumalı yol. */
  probePath: string
}

/**
 * Rol için hazır (giriş yapılmış) bir tarayıcı bağlamı verir.
 *
 * Aynı testte birden çok rol gerektiğinde (E2E 3: editör → öğrenci → veli)
 * her rol kendi bağlamında yaşar; çerezler birbirini ezmez.
 */
export async function contextForRole(
  browser: Browser,
  role: AccountRole,
  options: RoleContextOptions,
): Promise<BrowserContext> {
  const email = ACCOUNTS[role]
  const file = statePath(email)
  mkdirSync(STATE_DIR, { recursive: true })

  if (isFresh(file)) {
    const reused = await browser.newContext({ storageState: file })
    const page = await reused.newPage()
    if (await isSignedIn(page, options.probePath)) {
      await page.close()
      return reused
    }
    await page.close()
    await reused.close()
  }

  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, email)
  await context.storageState({ path: file })
  await page.close()
  return context
}

/** Rol için giriş yapılmış tek bir sayfa açar. */
export async function pageForRole(
  browser: Browser,
  role: AccountRole,
  options: RoleContextOptions,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await contextForRole(browser, role, options)
  const page = await context.newPage()
  return { context, page }
}
