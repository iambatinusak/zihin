#!/usr/bin/env node
/**
 * Migration koşucusu — gerçek bir PostgreSQL'e (docker compose / bulut) uygular.
 *
 * `verify-schema.mjs` gömülü, tek kullanımlık bir veritabanına uygular ve her
 * seferinde sıfırdan başlar. Bu betik ise KALICI bir veritabanına uygular, bu
 * yüzden hangi dosyanın daha önce çalıştığını `public.schema_migrations`
 * tablosunda tutar; `docker compose up` tekrar çalıştığında iş yapmaz.
 *
 * Sıralama önemli: `0002_identity.sql` `auth.users` tablosuna yabancı anahtar
 * kurar, ama o tabloyu GoTrue kendi başlarken oluşturur. Bu yüzden betik önce
 * veritabanının, sonra `auth.users`'ın hazır olmasını bekler.
 *
 * Kullanım:
 *   node scripts/migrate.mjs                       # migration'ları uygula
 *   node scripts/migrate.mjs --seed                # ardından seed'i de çalıştır
 *   node scripts/migrate.mjs --status              # ne uygulanmış, ne bekliyor
 */
import { Client } from 'pg'
import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DB_ROOT = join(HERE, '..')
const REPO_ROOT = join(DB_ROOT, '..', '..')
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations')

const args = new Set(process.argv.slice(2))
/*
 * Seed iki yoldan da istenebilir: `--seed` bayrağı ya da SEED_DATABASE=true.
 * İkincisi docker compose içindir — komut satırında koşullu bayrak üretmek
 * kabuk kaçışlarına ve YAML'da okunması güç satırlara yol açıyordu.
 */
const runSeed = args.has('--seed') || process.env.SEED_DATABASE === 'true'
const statusOnly = args.has('--status')

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
}

const CONNECTION =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@db:5432/postgres'

/** Belirli bir koşul sağlanana kadar bekler; sağlanmazsa açıklayıcı hata verir. */
async function waitFor(label, probe, { timeoutMs = 120_000, intervalMs = 2_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  let announced = false

  while (Date.now() < deadline) {
    try {
      if (await probe()) {
        if (announced) console.log(`  ${c.green}✓${c.reset} ${label} hazır`)
        return
      }
    } catch (error) {
      lastError = error
    }
    if (!announced) {
      console.log(`  ${c.dim}${label} bekleniyor...${c.reset}`)
      announced = true
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(
    `${label} ${timeoutMs / 1000} saniyede hazır olmadı.` +
      (lastError ? ` Son hata: ${lastError.message}` : ''),
  )
}

async function connect() {
  const client = new Client({ connectionString: CONNECTION })
  await client.connect()
  await client.query("set client_encoding to 'UTF8'")
  return client
}

async function main() {
  console.log(
    `${c.bold}Zihin migration${c.reset} ${c.dim}→ ${CONNECTION.replace(/:[^:@]*@/, ':****@')}${c.reset}\n`,
  )

  // 1. Veritabanı ayakta mı?
  let client = null
  await waitFor('PostgreSQL', async () => {
    try {
      client = await connect()
      return true
    } catch (error) {
      if (client) {
        await client.end().catch(() => {})
        client = null
      }
      throw error
    }
  })

  if (!client) throw new Error('Veritabanına bağlanılamadı.')

  try {
    // 2. GoTrue kendi şemasını kurdu mu? `0002_identity.sql` buna bağlı.
    await waitFor('auth.users (GoTrue)', async () => {
      const { rows } = await client.query(`select to_regclass('auth.users') is not null as ready`)
      return rows[0]?.ready === true
    })

    // 3. Kayıt tablosu. Migration'ların kendisi gibi bu da idempotent.
    await client.query(`
      create table if not exists public.schema_migrations (
        version     text primary key,
        checksum    text not null,
        applied_at  timestamptz not null default now(),
        duration_ms integer
      )
    `)
    await client.query(
      `comment on table public.schema_migrations is
       'Uygulanmış migration dosyaları. scripts/migrate.mjs tarafından yönetilir.'`,
    )

    /*
     * Bu tablo `public` şemasında olduğu için PostgREST onu API'ye açar.
     * İçinde sır yok, ama dosya adları ve sürüm geçmişi şema bilgisidir ve
     * projedeki "her tabloda RLS açık" değişmezini bozar. Yetki tamamen
     * geri alınır; yalnızca service_role okur.
     */
    await client.query(`alter table public.schema_migrations enable row level security`)
    await client.query(`revoke all on public.schema_migrations from anon, authenticated`)
    await client.query(`
      do $$
      begin
        if not exists (
          select 1 from pg_policy
           where polrelid = 'public.schema_migrations'::regclass
             and polname = 'schema_migrations_select_admin'
        ) then
          create policy schema_migrations_select_admin on public.schema_migrations
            for select to service_role using (true);
        end if;
      end
      $$;
    `)

    const files = existsSync(MIGRATIONS_DIR)
      ? (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
      : []

    const { rows: appliedRows } = await client.query(
      `select version, checksum from public.schema_migrations`,
    )
    const applied = new Map(appliedRows.map((r) => [r.version, r.checksum]))

    // 4. Değişmiş bir migration sessizce yeniden uygulanmaz — uyarılır.
    // Uygulanmış bir dosyayı düzenlemek, veritabanı ile depo arasında
    // fark yaratır; bunu fark etmemek bir sonraki hatanın kaynağıdır.
    const drifted = []
    for (const file of files) {
      const previous = applied.get(file)
      if (!previous) continue
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
      const checksum = createHash('sha256').update(sql).digest('hex')
      if (checksum !== previous) drifted.push(file)
    }

    const pending = files.filter((f) => !applied.has(f))

    if (statusOnly) {
      console.log(`${c.bold}Uygulanmış:${c.reset} ${applied.size}`)
      for (const file of files) {
        const mark = applied.has(file) ? `${c.green}✓${c.reset}` : `${c.yellow}·${c.reset}`
        console.log(`  ${mark} ${file}`)
      }
      if (drifted.length > 0) {
        console.log(
          `\n${c.yellow}Uygulandıktan sonra değiştirilmiş:${c.reset} ${drifted.join(', ')}`,
        )
      }
      return
    }

    if (drifted.length > 0) {
      console.log(
        `${c.yellow}!${c.reset} Şu dosyalar uygulandıktan SONRA değiştirilmiş: ${drifted.join(', ')}`,
      )
      console.log(
        `  ${c.dim}Veritabanı bu değişiklikleri içermiyor. Yeni bir migration yazın ya da` +
          ` geliştirme ortamında veritabanını sıfırlayın.${c.reset}\n`,
      )
    }

    if (pending.length === 0) {
      console.log(`${c.green}✓${c.reset} Şema güncel — ${applied.size} migration zaten uygulanmış.`)
    } else {
      console.log(`${pending.length} migration uygulanacak.\n`)

      for (const file of pending) {
        const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
        const checksum = createHash('sha256').update(sql).digest('hex')
        const started = Date.now()

        try {
          // Her dosya tek işlemde: hata alan dosya geri alınır, yarım şema oluşmaz.
          await client.query('begin')
          await client.query(sql)
          await client.query(
            `insert into public.schema_migrations (version, checksum, duration_ms)
             values ($1, $2, $3)`,
            [file, checksum, Date.now() - started],
          )
          await client.query('commit')
          console.log(`  ${c.green}✓${c.reset} ${file} ${c.dim}${Date.now() - started}ms${c.reset}`)
        } catch (error) {
          await client.query('rollback').catch(() => {})
          console.error(`  ${c.red}✗ ${file}${c.reset}`)
          console.error(`    ${c.red}${error.message}${c.reset}`)
          if (error.detail) console.error(`    ${c.dim}${error.detail}${c.reset}`)
          if (error.hint) console.error(`    ${c.yellow}${error.hint}${c.reset}`)
          throw new Error(`Migration başarısız: ${file}`)
        }
      }

      console.log(`\n${c.green}${c.bold}${pending.length} migration uygulandı.${c.reset}`)
    }
  } finally {
    await client.end().catch(() => {})
  }

  // 5. Seed — ayrı bir süreç olarak, üretimdekiyle aynı yoldan.
  if (runSeed) {
    console.log(`\n${c.bold}Seed${c.reset}`)
    const result = spawnSync('npx tsx seed/index.ts', {
      cwd: DB_ROOT,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, SUPABASE_DB_URL: CONNECTION },
    })
    if (result.status !== 0) {
      throw new Error(`Seed başarısız (çıkış kodu ${result.status}).`)
    }
  }
}

try {
  await main()
} catch (error) {
  console.error(`\n${c.red}${c.bold}${error.message}${c.reset}`)
  process.exit(1)
}
