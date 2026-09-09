#!/usr/bin/env node
/**
 * `node scripts/generate-keys.mjs` — Supabase yığını için gizli anahtarları üretir.
 *
 * Supabase'in `anon` ve `service_role` anahtarları sihirli dizeler değildir:
 * JWT_SECRET ile HS256 imzalanmış JWT'lerdir. İnternette dolaşan "demo"
 * anahtarların gizli anahtarı herkesçe bilinir; bir VM'de dışarı açılan bir
 * kuruluma o değerlerle çıkmak, veritabanını herkese açmak demektir.
 *
 * Bu betik her kurulum için yeni ve rastgele bir sır üretir, ardından iki
 * anahtarı ondan türetir.
 *
 * Kullanım:
 *   node scripts/generate-keys.mjs                 # ekrana yaz
 *   node scripts/generate-keys.mjs --write         # docker/.env dosyasına yaz
 *   node scripts/generate-keys.mjs --years 5       # geçerlilik süresi (varsayılan 10)
 */
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_PATH = join(ROOT, 'docker', '.env')

const args = process.argv.slice(2)
const shouldWrite = args.includes('--write')
const yearsIndex = args.indexOf('--years')
const years = yearsIndex >= 0 ? Number(args[yearsIndex + 1]) : 10

if (!Number.isFinite(years) || years <= 0) {
  console.error('--years pozitif bir sayı olmalı.')
  process.exit(1)
}

/** URL güvenli base64 (JWT'nin beklediği biçim; padding yok). */
function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** HS256 ile imzalanmış bir JWT üretir. */
function signJwt(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const signature = createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${data}.${signature}`
}

// --- anahtarları üret -------------------------------------------------------

// GoTrue en az 32 karakterlik bir sır ister; 64 hex karakter fazlasıyla yeterli.
const jwtSecret = randomBytes(32).toString('hex')
const issuedAt = Math.floor(Date.now() / 1000)
const expiresAt = issuedAt + Math.floor(years * 365.25 * 24 * 60 * 60)

const anonKey = signJwt({ role: 'anon', iss: 'supabase', iat: issuedAt, exp: expiresAt }, jwtSecret)
const serviceKey = signJwt(
  { role: 'service_role', iss: 'supabase', iat: issuedAt, exp: expiresAt },
  jwtSecret,
)

// Diğer sırlar. Hepsi ayrı: birinin sızması diğerlerini açmasın.
const secrets = {
  POSTGRES_PASSWORD: randomBytes(24).toString('base64url'),
  JWT_SECRET: jwtSecret,
  ANON_KEY: anonKey,
  SERVICE_ROLE_KEY: serviceKey,
  CRON_SECRET: randomBytes(24).toString('base64url'),
  DASHBOARD_PASSWORD: randomBytes(12).toString('base64url'),
  SECRET_KEY_BASE: randomBytes(32).toString('hex'),
}

// --- çıktı ------------------------------------------------------------------

if (!shouldWrite) {
  console.log(`# ${years} yıl geçerli anahtarlar (üretim: ${new Date().toISOString()})`)
  console.log('# docker/.env dosyasına yapıştırın ya da --write ile otomatik yazdırın.\n')
  for (const [key, value] of Object.entries(secrets)) console.log(`${key}=${value}`)
  process.exit(0)
}

if (!existsSync(ENV_PATH)) {
  console.error(
    `docker/.env bulunamadı.\n` +
      `  Önce şablonu kopyalayın:  cp docker/.env.example docker/.env\n` +
      `  Sonra bu komutu tekrar çalıştırın.`,
  )
  process.exit(1)
}

let env = readFileSync(ENV_PATH, 'utf8')
const replaced = []

for (const [key, value] of Object.entries(secrets)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(env)) {
    env = env.replace(pattern, `${key}=${value}`)
    replaced.push(key)
  } else {
    env += `\n${key}=${value}`
    replaced.push(key)
  }
}

writeFileSync(ENV_PATH, env, 'utf8')

console.log(`✓ docker/.env güncellendi — ${replaced.length} anahtar yazıldı:`)
for (const key of replaced) console.log(`    ${key}`)
console.log(`\nAnahtarlar ${years} yıl geçerli.`)
console.log('docker/.env dosyasını sürüm kontrolüne EKLEMEYİN (.gitignore zaten kapsıyor).')
