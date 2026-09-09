import type { FullConfig } from '@playwright/test'
import { MAILPIT_URL } from './helpers/mail'

/**
 * Koşum öncesi tek denetim: yığın ayakta mı?
 *
 * Uygulama `next dev` ile DEĞİL, docker compose ile gelir (bkz. e2e/README.md).
 * Adres kapalıyken testleri başlatmak on binlerce satır anlamsız zaman aşımı
 * üretir; burada erken ve TÜRKÇE bir mesajla durulur.
 */

const PROBE_TIMEOUT_MS = 5_000

async function reachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    // 4xx bile "sunucu ayakta" demektir; yalnızca bağlantı hatası engeldir.
    return response.status < 600
  } catch {
    return false
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:14000'

  if (!(await reachable(baseURL))) {
    throw new Error(
      `\nUygulamaya ulaşılamıyor: ${baseURL}\n\n` +
        'Uçtan uca testler docker yığınına karşı çalışır. Önce yığını başlatın:\n' +
        '  docker compose -f docker/docker-compose.yml up -d\n\n' +
        'Servisler hazır olduğunda (migration ve seed tek seferlik `migrate` servisiyle uygulanır)\n' +
        'testleri yeniden çalıştırın:  pnpm --filter @zihin/web test:e2e\n' +
        'Farklı bir adres kullanıyorsanız E2E_BASE_URL değişkenini verin.\n',
    )
  }

  if (!(await reachable(`${MAILPIT_URL}/api/v1/messages?limit=1`))) {
    throw new Error(
      `\nMailpit'e ulaşılamıyor: ${MAILPIT_URL}\n\n` +
        'Kayıt akışı (E2E 1) doğrulama postasını Mailpit üzerinden okur.\n' +
        'Yığını başlatın:  docker compose -f docker/docker-compose.yml up -d\n' +
        'Farklı bir adres kullanıyorsanız E2E_MAILPIT_URL değişkenini verin.\n',
    )
  }
}
