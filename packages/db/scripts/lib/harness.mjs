/**
 * Yerel sema dogrulama kosumu.
 *
 * Docker gerektirmeden gercek bir PostgreSQL 17 ornegi ayaga kaldirir,
 * Supabase taklidini yukler ve `supabase/migrations` altindaki dosyalari
 * sirayla uygular. Boylece migration'lar ve RLS politikalari canli bir
 * veritabanina karsi dogrulanabilir.
 *
 * SINIRLAR (bilincli):
 *  - Sunucu kodlamasi SQL_ASCII, siralama duzeni C. Windows'ta Turkce sistem
 *    yerel ayari initdb'yi UTF8 ile baslatmaya izin vermiyor. Turkce metin
 *    bayt bazinda sorunsuz gidip geliyor; ancak `lower()`/`upper()` ve
 *    siralama Turkce'ye ozgu davranmaz. Uretimde (Supabase) kodlama UTF8'dir.
 *  - `pg_cron` yok; zamanlanmis isler ayri, tolere edilen bir migration'da.
 *  - Auth/Storage yalnizca taklit; gercek Supabase servisleri calismaz.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const DB_PACKAGE_ROOT = join(HERE, '..', '..')
export const REPO_ROOT = join(DB_PACKAGE_ROOT, '..', '..')
export const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations')
const SHIM_PATH = join(HERE, '..', 'supabase-shim.sql')

const DEFAULT_PORT = 55433

/**
 * Gomulu Postgres'i baslatir ve baglanmis bir istemci dondurur.
 * Veri dizini her zaman ASCII bir gecici yolda olusturulur; depo yolunda
 * Turkce karakter bulunmasi initdb'yi bozabiliyor.
 */
export async function startPostgres({ port = DEFAULT_PORT } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'zihin-pg-'))

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    // Turkce Windows yerel ayari initdb tarafindan reddediliyor; C/SQL_ASCII
    // tek calisan bilesim. Ayrintili gerekce icin dosya basligina bakin.
    initdbFlags: ['--locale=C', '--encoding=SQL_ASCII'],
  })

  await pg.initialise()
  await pg.start()

  const client = pg.getPgClient()
  await client.connect()
  // Turkce icerigin bozulmadan gidip gelmesi icin istemci tarafi UTF8.
  await client.query("set client_encoding to 'UTF8'")

  return {
    pg,
    client,
    dataDir,
    async stop() {
      try {
        await client.end()
      } catch {
        /* baglanti zaten kapali olabilir */
      }
      try {
        await pg.stop()
      } catch {
        /* surec zaten sonlanmis olabilir */
      }
      await rm(dataDir, { recursive: true, force: true }).catch(() => {})
    },
  }
}

/** Supabase taklidini (sema, rol, auth.uid vb.) yukler. */
export async function applyShim(client) {
  const sql = await readFile(SHIM_PATH, 'utf8')
  await client.query(sql)
}

/** Migration dosyalarini ada gore sirali dondurur. */
export async function listMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return []
  const files = await readdir(MIGRATIONS_DIR)
  return files.filter((f) => f.endsWith('.sql')).sort()
}

/**
 * Migration'lari sirayla uygular.
 * Her dosya tek bir islemde calisir: hata alan dosya geri alinir, boylece
 * kismi uygulanmis bir sema olusmaz.
 */
export async function applyMigrations(client, { stopOnError = true, log = () => {} } = {}) {
  const files = await listMigrations()
  const results = []

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
    const started = process.hrtime.bigint()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('commit')
      const ms = Number(process.hrtime.bigint() - started) / 1e6
      results.push({ file, ok: true, ms })
      log({ file, ok: true, ms })
    } catch (error) {
      await client.query('rollback').catch(() => {})
      const detail = {
        message: error.message,
        position: error.position,
        hint: error.hint,
        detail: error.detail,
        line: error.position ? lineAt(sql, Number(error.position)) : null,
      }
      results.push({ file, ok: false, error: detail })
      log({ file, ok: false, error: detail })
      if (stopOnError) break
    }
  }

  return results
}

/** Hata konumundan (karakter ofseti) okunabilir satir/sutun bilgisi cikarir. */
function lineAt(sql, position) {
  const upto = sql.slice(0, position)
  const line = upto.split('\n').length
  const col = position - upto.lastIndexOf('\n')
  const text = sql.split('\n')[line - 1] ?? ''
  return { line, col, text: text.trim().slice(0, 160) }
}

/**
 * Belirli bir kullanici kimligiyle sorgu calistirir (RLS testleri icin).
 * `authenticated` rolune gecer ve JWT iddialarini ayarlar; islem sonunda
 * her sey geri alinir, boylece testler birbirini kirletmez.
 */
export async function asUser(client, { userId, role = 'authenticated', email = null }, fn) {
  const claims = JSON.stringify({ sub: userId, role, email, aud: 'authenticated' })
  await client.query('begin')
  try {
    await client.query(`set local role ${role}`)
    await client.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
    return await fn(client)
  } finally {
    await client.query('rollback').catch(() => {})
  }
}

/** Anonim (giris yapmamis) kullanici olarak calistirir. */
export async function asAnon(client, fn) {
  await client.query('begin')
  try {
    await client.query('set local role anon')
    await client.query('select set_config($1, $2, true)', ['request.jwt.claims', '{"role":"anon"}'])
    return await fn(client)
  } finally {
    await client.query('rollback').catch(() => {})
  }
}

/** Semadaki tablolari ve RLS durumlarini dondurur — kapsam denetimi icin. */
export async function inspectSchema(client) {
  const { rows: tables } = await client.query(`
    select c.relname as table_name,
           c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced,
           (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname
  `)

  const { rows: indexes } = await client.query(`
    select tablename, indexname, indexdef
      from pg_indexes
     where schemaname = 'public'
     order by tablename, indexname
  `)

  const { rows: functions } = await client.query(`
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
     order by p.proname
  `)

  const { rows: triggers } = await client.query(`
    select c.relname as table_name, t.tgname as trigger_name
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal
     order by c.relname, t.tgname
  `)

  return { tables, indexes, functions, triggers }
}
