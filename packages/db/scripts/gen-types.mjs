#!/usr/bin/env node
/**
 * `packages/db/src/types.ts` üretici.
 *
 * `supabase gen types` çalışan bir Supabase örneği (dolayısıyla Docker) ister.
 * Bu betik aynı işi gömülü PostgreSQL koşumu üzerinden yapar: migration'ları
 * uygular, katalogdan sema bilgisini okur ve Supabase istemcisinin beklediği
 * `Database` tipini üretir.
 *
 * Kullanım:
 *   node scripts/gen-types.mjs            # packages/db/src/types.ts dosyasına yazar
 *   node scripts/gen-types.mjs --stdout   # ekrana basar
 */
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { startPostgres, applyShim, applyMigrations, DB_PACKAGE_ROOT } from './lib/harness.mjs'

const OUT = join(DB_PACKAGE_ROOT, 'src', 'types.ts')
const toStdout = process.argv.includes('--stdout')

/** Postgres türü -> TypeScript türü. */
function tsType(column) {
  const { data_type: dataType, udt_name: udt } = column

  // Diziler: udt_name '_' ile başlar (örn. _uuid, _int4, _text).
  if (dataType === 'ARRAY') {
    const inner = scalarType(udt.replace(/^_/, ''))
    return `${inner}[]`
  }
  return scalarType(udt)
}

function scalarType(udt) {
  switch (udt) {
    case 'uuid':
    case 'text':
    case 'varchar':
    case 'bpchar':
    case 'name':
    case 'citext':
    case 'tsvector':
      return 'string'
    case 'int2':
    case 'int4':
    case 'int8':
    case 'float4':
    case 'float8':
    case 'numeric':
      return 'number'
    case 'bool':
      return 'boolean'
    case 'json':
    case 'jsonb':
      return 'Json'
    // Supabase istemcisi tarih/saat değerlerini ISO metni olarak taşır.
    case 'timestamptz':
    case 'timestamp':
    case 'date':
    case 'time':
    case 'timetz':
    case 'interval':
      return 'string'
    default:
      return 'unknown'
  }
}

/**
 * `check (col in ('a','b'))` kısıtlarından birleşim (union) tipi çıkarır.
 * Şemada Postgres enum'ları yerine text + check kullanıldığı için tip
 * güvenliğini ancak böyle kazanabiliyoruz.
 */
function unionFromCheck(checkSource, columnName) {
  if (!checkSource) return null
  // Yalnızca tek bir kolonu hedefleyen basit IN listelerini ele alıyoruz;
  // bileşik koşullarda sessizce vazgeçip `string` bırakıyoruz.
  //
  // Postgres, kısıtı kolonun tipine göre iki biçimde yazdırır:
  //   text kolon      ->  (source = ANY (ARRAY['a'::text, ...]))
  //   text'e çevrilen ->  ((role)::text = ANY ((ARRAY['a'::text, ...])::text[]))
  // Nullable kolonlarda ayrıca ((col IS NULL) OR (col = ANY (...))) sarmalı olur.
  // Üç biçimi de aynı desenle yakalıyoruz.
  const pattern = new RegExp(
    `\\(?${columnName}\\)?(?:::text)?\\s*=\\s*ANY\\s*\\(\\s*\\(?ARRAY\\[([^\\]]+)\\]`,
    'i',
  )
  const match = checkSource.match(pattern)
  if (!match) return null

  const literals = [...match[1].matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"))
  if (literals.length === 0) return null
  return literals.map((l) => `'${l}'`).join(' | ')
}

const harness = await startPostgres({ port: 55434 })

try {
  await applyShim(harness.client)
  const applied = await applyMigrations(harness.client, { stopOnError: true })
  const failed = applied.find((r) => !r.ok)
  if (failed) {
    console.error(`Migration başarısız: ${failed.file}\n${failed.error.message}`)
    process.exit(1)
  }

  const { client } = harness

  const { rows: columns } = await client.query(`
    select c.table_name,
           c.column_name,
           c.ordinal_position,
           c.is_nullable = 'YES' as is_nullable,
           c.column_default,
           c.data_type,
           c.udt_name,
           (c.is_identity = 'YES' or c.column_default is not null) as has_default
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
     order by c.table_name, c.ordinal_position
  `)

  const { rows: views } = await client.query(`
    select c.table_name, c.column_name, c.ordinal_position,
           c.is_nullable = 'YES' as is_nullable, c.data_type, c.udt_name
      from information_schema.columns c
      join information_schema.views v
        on v.table_schema = c.table_schema and v.table_name = c.table_name
     where c.table_schema = 'public'
     order by c.table_name, c.ordinal_position
  `)

  // check kısıtlarını kolon bazında topla (text + check -> union tipi)
  const { rows: checks } = await client.query(`
    select rel.relname as table_name,
           pg_get_constraintdef(con.oid) as definition
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public' and con.contype = 'c'
  `)

  const checksByTable = new Map()
  for (const row of checks) {
    if (!checksByTable.has(row.table_name)) checksByTable.set(row.table_name, [])
    checksByTable.get(row.table_name).push(row.definition)
  }

  const { rows: functions } = await client.query(`
    select p.proname as name,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_result(p.oid) as returns
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
     order by p.proname
  `)

  // --- tip metnini oluştur ------------------------------------------------
  const tables = new Map()
  for (const col of columns) {
    if (!tables.has(col.table_name)) tables.set(col.table_name, [])
    tables.get(col.table_name).push(col)
  }

  const viewMap = new Map()
  for (const col of views) {
    if (!viewMap.has(col.table_name)) viewMap.set(col.table_name, [])
    viewMap.get(col.table_name).push(col)
  }

  const lines = []
  lines.push(`/**`)
  lines.push(` * OTOMATİK ÜRETİLDİ — elle düzenlemeyin.`)
  lines.push(` *`)
  lines.push(` * Üretim komutu:  pnpm --filter @zihin/db db:types`)
  lines.push(` * Kaynak:         supabase/migrations/*.sql`)
  lines.push(` *`)
  lines.push(` * Şema değiştiğinde bu dosyayı yeniden üretin; aksi hâlde uygulama`)
  lines.push(` * kodu var olmayan kolonlara tip güvenliğiyle erişiyormuş gibi görünür.`)
  lines.push(` */`)
  lines.push(``)
  lines.push(
    `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]`,
  )
  lines.push(``)
  lines.push(`export type Database = {`)
  lines.push(`  public: {`)
  lines.push(`    Tables: {`)

  for (const [table, cols] of [...tables].sort((a, b) => a[0].localeCompare(b[0]))) {
    const tableChecks = checksByTable.get(table) ?? []
    lines.push(`      ${table}: {`)

    // Row
    lines.push(`        Row: {`)
    for (const col of cols) {
      const union = tableChecks
        .map((def) => unionFromCheck(def, col.column_name))
        .find((u) => u !== null)
      const base = union ?? tsType(col)
      lines.push(`          ${col.column_name}: ${base}${col.is_nullable ? ' | null' : ''}`)
    }
    lines.push(`        }`)

    // Insert — varsayılanı olan ve nullable kolonlar isteğe bağlı
    lines.push(`        Insert: {`)
    for (const col of cols) {
      const union = tableChecks
        .map((def) => unionFromCheck(def, col.column_name))
        .find((u) => u !== null)
      const base = union ?? tsType(col)
      const optional = col.has_default || col.is_nullable
      lines.push(
        `          ${col.column_name}${optional ? '?' : ''}: ${base}${col.is_nullable ? ' | null' : ''}`,
      )
    }
    lines.push(`        }`)

    // Update — her şey isteğe bağlı
    lines.push(`        Update: {`)
    for (const col of cols) {
      const union = tableChecks
        .map((def) => unionFromCheck(def, col.column_name))
        .find((u) => u !== null)
      const base = union ?? tsType(col)
      lines.push(`          ${col.column_name}?: ${base}${col.is_nullable ? ' | null' : ''}`)
    }
    lines.push(`        }`)
    // supabase-js tip cikarimi Relationships alanini bekler (GenericTable);
    // eksikse sorgular `never` doner. Iliskiler uretilmedigi icin bos tuple.
    lines.push(`        Relationships: []`)
    lines.push(`      }`)
  }

  lines.push(`    }`)

  // Views
  lines.push(`    Views: {`)
  for (const [view, cols] of [...viewMap].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`      ${view}: {`)
    lines.push(`        Row: {`)
    for (const col of cols) {
      lines.push(`          ${col.column_name}: ${tsType(col)}${col.is_nullable ? ' | null' : ''}`)
    }
    lines.push(`        }`)
    lines.push(`        Relationships: []`)
    lines.push(`      }`)
  }
  lines.push(`    }`)

  // Functions
  lines.push(`    Functions: {`)
  for (const fn of functions) {
    lines.push(`      ${fn.name}: {`)
    lines.push(`        Args: Record<string, unknown>`)
    lines.push(`        Returns: unknown`)
    lines.push(`      }`)
  }
  lines.push(`    }`)
  lines.push(`    Enums: Record<string, never>`)
  lines.push(`    CompositeTypes: Record<string, never>`)
  lines.push(`  }`)
  lines.push(`}`)
  lines.push(``)

  // Kolaylık kısayolları — uygulama kodunda çok kullanılır.
  lines.push(`/** Tablo satır tipi kısayolu:  Tables<'profiles'> */`)
  lines.push(
    `export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']`,
  )
  lines.push(`/** Ekleme tipi kısayolu. */`)
  lines.push(
    `export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']`,
  )
  lines.push(`/** Güncelleme tipi kısayolu. */`)
  lines.push(
    `export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']`,
  )
  lines.push(`/** Görünüm satır tipi kısayolu. */`)
  lines.push(
    `export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']`,
  )
  lines.push(``)

  const output = lines.join('\n')

  if (toStdout) {
    console.log(output)
  } else {
    await writeFile(OUT, output, 'utf8')
    console.log(
      `✓ ${OUT} üretildi — ${tables.size} tablo, ${viewMap.size} görünüm, ${functions.length} fonksiyon`,
    )
  }
} catch (error) {
  console.error('Tip üretimi başarısız:', error.message)
  process.exitCode = 1
} finally {
  await harness.stop()
}
