#!/usr/bin/env node
/**
 * `pnpm --filter @zihin/db test:migrate` — docker yığınının migration
 * koşucusunu gerçek bir PostgreSQL'e karşı dener.
 *
 * `verify-schema.mjs` her seferinde sıfırdan uygular; bu betik KALICI bir
 * veritabanı senaryosunu taklit eder ve asıl merak edilen şeyi kanıtlar:
 * `migrate.mjs` iki kez çalıştığında ikinci koşumun hiçbir şey yapmaması,
 * yani `docker compose up` her tekrarında şemayı bozmaması.
 */
import { spawnSync } from 'node:child_process'
import { startPostgres, applyShim, DB_PACKAGE_ROOT } from './lib/harness.mjs'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
}

let passed = 0
let failed = 0
const check = (label, ok, detail = '') => {
  if (ok) {
    passed++
    console.log(`  ${c.green}✓${c.reset} ${label}`)
  } else {
    failed++
    console.log(`  ${c.red}✗ ${label}${c.reset}${detail ? `  ${c.dim}${detail}${c.reset}` : ''}`)
  }
}

const PORT = 55437
const harness = await startPostgres({ port: PORT })
const url = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`

const runMigrate = (extraArgs = '') =>
  spawnSync(`node scripts/migrate.mjs ${extraArgs}`, {
    cwd: DB_PACKAGE_ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, SUPABASE_DB_URL: url },
  })

try {
  // Supabase taklidi `auth.users`'i olusturur — compose'da bunu GoTrue yapar.
  await applyShim(harness.client)
  console.log(`${c.green}✓${c.reset} Supabase taklidi yuklendi (auth.users hazir)\n`)

  const count = async (sql) => Number((await harness.client.query(sql)).rows[0].n)

  // --- 1. kosum ------------------------------------------------------------
  console.log(`${c.bold}Birinci kosum${c.reset}`)
  const first = runMigrate()
  if (first.status !== 0) {
    console.error(first.stdout)
    console.error(first.stderr)
    throw new Error(`migrate.mjs cikis kodu ${first.status}`)
  }
  console.log(first.stdout.trim().split('\n').slice(-3).join('\n'))

  const migrationCount = await count('select count(*) n from public.schema_migrations')
  const tableCount = await count(
    "select count(*) n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
  )
  check('migration kayitlari yazildi', migrationCount >= 15, `${migrationCount} kayit`)
  check('tablolar olustu', tableCount >= 35, `${tableCount} tablo`)

  const rlsOff = await count(`
    select count(*) n from pg_class c
     join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname='public' and c.relkind='r' and not c.relrowsecurity`)
  check('RLS acik olmayan tablo yok (schema_migrations dahil)', rlsOff === 0, `${rlsOff} tablo`)

  const migrationsExposed = await count(`
    select count(*) n from information_schema.role_table_grants
     where table_schema='public' and table_name='schema_migrations'
       and grantee in ('anon','authenticated')`)
  check(
    'schema_migrations anon/authenticated rolune kapali',
    migrationsExposed === 0,
    `${migrationsExposed} yetki`,
  )

  // --- 2. kosum (asil sinav) ----------------------------------------------
  console.log(`\n${c.bold}Ikinci kosum (idempotency)${c.reset}`)
  const second = runMigrate()
  if (second.status !== 0) {
    console.error(second.stdout)
    console.error(second.stderr)
    throw new Error(`ikinci kosum cikis kodu ${second.status}`)
  }

  check(
    'ikinci kosum "guncel" diyor',
    /Sema guncel|Şema güncel/.test(second.stdout),
    second.stdout.trim().split('\n').pop(),
  )
  check(
    'yeni migration kaydi eklenmedi',
    (await count('select count(*) n from public.schema_migrations')) === migrationCount,
  )
  check(
    'tablo sayisi degismedi',
    (await count(
      "select count(*) n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
    )) === tableCount,
  )

  // --- checksum kaymasi ----------------------------------------------------
  console.log(`\n${c.bold}Degistirilmis migration tespiti${c.reset}`)
  await harness.client.query(
    `update public.schema_migrations set checksum = 'bozuk' where version = (
       select version from public.schema_migrations order by version limit 1)`,
  )
  const drift = runMigrate('--status')
  check(
    'uygulandiktan sonra degisen dosya bildiriliyor',
    /degistirilmis|değiştirilmiş/i.test(drift.stdout),
    drift.stdout.trim().split('\n').pop(),
  )

  console.log(
    `\n${c.bold}Sonuc:${c.reset} ${c.green}${passed} gecti${c.reset}` +
      (failed > 0 ? `, ${c.red}${failed} kaldi${c.reset}` : ''),
  )
} catch (error) {
  console.error(`${c.red}Kosum hatasi:${c.reset}`, error.message)
  failed++
} finally {
  await harness.stop()
}

process.exit(failed > 0 ? 1 : 0)
