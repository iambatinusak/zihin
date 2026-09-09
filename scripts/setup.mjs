#!/usr/bin/env node
/**
 * `pnpm setup` — tek komutla geliştirme ortamını hazırlar.
 *
 * Adımlar:
 *   1. Gerekli araçları kontrol et (node, pnpm, supabase CLI, docker).
 *   2. .env.local yoksa .env.example'dan üret.
 *   3. `supabase start` ile yerel yığını ayağa kaldır.
 *   4. Çıkan anahtarları .env.local'e yaz.
 *   5. Migration'ları uygula ve seed verisini yükle.
 *
 * Her adım, hata verdiğinde ne yapılması gerektiğini anlatır; sessizce
 * yarım bırakmaz.
 */
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_LOCAL = join(ROOT, '.env.local')
const ENV_EXAMPLE = join(ROOT, '.env.example')

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

let step = 0
const info = (msg) => console.log(`${c.blue}${c.bold}[${++step}]${c.reset} ${msg}`)
const ok = (msg) => console.log(`    ${c.green}✓${c.reset} ${msg}`)
const warn = (msg) => console.log(`    ${c.yellow}!${c.reset} ${msg}`)
const die = (msg, hint) => {
  console.error(`\n${c.red}${c.bold}Kurulum durdu:${c.reset} ${msg}`)
  if (hint) console.error(`${c.dim}${hint}${c.reset}\n`)
  process.exit(1)
}

function has(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which'
  return spawnSync(probe, [cmd], { stdio: 'ignore' }).status === 0
}

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts })
}

function capture(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// --- 1. Araçlar -----------------------------------------------------------
info('Gerekli araçlar kontrol ediliyor...')

const major = Number(process.versions.node.split('.')[0])
if (major < 20) die(`Node.js 20+ gerekli, bulunan: ${process.version}`, 'https://nodejs.org')
ok(`Node.js ${process.version}`)

if (!has('pnpm')) die('pnpm bulunamadı.', 'Kurmak için: npm i -g pnpm@9.15.4')
ok('pnpm')

const hasDocker = has('docker')
const hasSupabase = has('supabase') || has('supabase.exe')

if (!hasDocker) {
  warn('Docker bulunamadı — yerel Supabase başlatılamayacak.')
  warn('Docker Desktop kurun (https://docs.docker.com/desktop) veya bulut Supabase')
  warn('projenizin bilgilerini .env.local dosyasına elle girin.')
}
if (!hasSupabase) {
  warn('Supabase CLI bulunamadı. Kurmak için: npm i -g supabase')
}

// --- 2. .env.local --------------------------------------------------------
info('.env.local hazırlanıyor...')
if (!existsSync(ENV_LOCAL)) {
  copyFileSync(ENV_EXAMPLE, ENV_LOCAL)
  ok('.env.example dosyasından .env.local oluşturuldu')
} else {
  ok('.env.local zaten var, korunuyor')
}

// --- 3. Bağımlılıklar -----------------------------------------------------
info('Bağımlılıklar kuruluyor...')
run('pnpm install')
ok('Bağımlılıklar hazır')

// --- 4. Supabase ----------------------------------------------------------
if (hasDocker && hasSupabase) {
  info('Yerel Supabase başlatılıyor (ilk çalıştırmada imajlar iner, birkaç dakika sürebilir)...')
  try {
    run('supabase start')
  } catch {
    warn('supabase start başarısız oldu. Zaten çalışıyor olabilir; devam ediliyor.')
  }

  info('Supabase anahtarları .env.local dosyasına yazılıyor...')
  try {
    const status = capture('supabase status -o env')
    const values = Object.fromEntries(
      status
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.includes('='))
        .map((line) => {
          const idx = line.indexOf('=')
          return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')]
        }),
    )

    const mapping = {
      NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
      SUPABASE_DB_URL: values.DB_URL,
    }

    let env = readFileSync(ENV_LOCAL, 'utf8')
    for (const [key, value] of Object.entries(mapping)) {
      if (!value) continue
      const pattern = new RegExp(`^${key}=.*$`, 'm')
      env = pattern.test(env) ? env.replace(pattern, `${key}=${value}`) : `${env}\n${key}=${value}`
    }
    writeFileSync(ENV_LOCAL, env)
    // apps/web kendi .env.local'ını okur; kök dosyanın kopyasını bırak.
    writeFileSync(join(ROOT, 'apps', 'web', '.env.local'), env)
    ok('Anahtarlar yazıldı')
  } catch (error) {
    warn(`Anahtarlar okunamadı: ${error.message}`)
    warn('`supabase status` çıktısındaki değerleri .env.local dosyasına elle girin.')
  }

  info('Migration ve seed uygulanıyor...')
  try {
    run('supabase db reset')
    ok('Şema ve seed hazır')
  } catch {
    die(
      'Migration/seed başarısız.',
      'supabase/migrations altındaki SQL dosyalarını kontrol edin, sonra `supabase db reset` çalıştırın.',
    )
  }
} else {
  warn('Supabase adımları atlandı. Şema ve seed için sırasıyla:')
  warn('  supabase start && supabase db reset')
}

console.log(`
${c.green}${c.bold}Kurulum tamam.${c.reset}

  ${c.bold}pnpm dev${c.reset}                 Uygulamayı başlat  ${c.dim}http://localhost:3000${c.reset}
  ${c.bold}supabase status${c.reset}          Yerel servis adresleri (Studio: :54323, e-posta: :54324)

  ${c.dim}Test hesapları (şifre: Test1234!)${c.reset}
    ogrenci@test.com · veli@test.com · ogretmen@test.com · editor@test.com · admin@test.com
`)
