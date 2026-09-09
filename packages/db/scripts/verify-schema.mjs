#!/usr/bin/env node
/**
 * `pnpm --filter @zihin/db verify` — migration'lari gercek bir PostgreSQL
 * ornegine karsi dogrular.
 *
 * Docker gerektirmez: gomulu bir Postgres 17 baslatir, Supabase taklidini
 * yukler, `supabase/migrations` altindaki dosyalari sirayla uygular ve
 * sonucu ozetler. Hata varsa dosya + satir + Postgres mesajiyla raporlar.
 *
 * Kullanim:
 *   node scripts/verify-schema.mjs            # uygula ve ozetle
 *   node scripts/verify-schema.mjs --inspect  # tablo/RLS/indeks dokumu de ver
 *   node scripts/verify-schema.mjs --continue # ilk hatada durma
 */
import { startPostgres, applyShim, applyMigrations, inspectSchema } from './lib/harness.mjs'

const args = new Set(process.argv.slice(2))
const showInspect = args.has('--inspect')
const stopOnError = !args.has('--continue')

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
}

console.log(`${c.dim}Gomulu PostgreSQL baslatiliyor...${c.reset}`)
const harness = await startPostgres()
let exitCode = 0

try {
  await applyShim(harness.client)
  console.log(`${c.green}✓${c.reset} Supabase taklidi yuklendi (auth, storage, uzantilar, roller)`)

  const results = await applyMigrations(harness.client, {
    stopOnError,
    log: ({ file, ok, ms, error }) => {
      if (ok) {
        console.log(`${c.green}✓${c.reset} ${file} ${c.dim}${ms.toFixed(0)}ms${c.reset}`)
      } else {
        console.log(`${c.red}✗ ${file}${c.reset}`)
        console.log(`  ${c.red}${error.message}${c.reset}`)
        if (error.line) {
          console.log(
            `  ${c.dim}satir ${error.line.line}:${error.line.col}${c.reset}  ${error.line.text}`,
          )
        }
        if (error.detail) console.log(`  ${c.dim}detay: ${error.detail}${c.reset}`)
        if (error.hint) console.log(`  ${c.yellow}ipucu: ${error.hint}${c.reset}`)
      }
    },
  })

  const failed = results.filter((r) => !r.ok)
  if (results.length === 0) {
    console.log(`${c.yellow}!${c.reset} supabase/migrations altinda .sql dosyasi yok.`)
  }

  if (failed.length > 0) {
    exitCode = 1
    console.log(`\n${c.red}${c.bold}${failed.length} migration basarisiz.${c.reset}`)
  } else if (results.length > 0) {
    console.log(`\n${c.green}${c.bold}${results.length} migration sorunsuz uygulandi.${c.reset}`)
  }

  if (results.length > 0 && failed.length === 0) {
    const { tables, indexes, functions, triggers } = await inspectSchema(harness.client)

    const withoutRls = tables.filter((t) => !t.rls_enabled)
    // Politika kontrolu TUM tablolar uzerinden yapilir. Yalnizca RLS acik
    // olanlara bakmak, RLS hic acilmamisken bos kume donup yanlis bir ✓ verir.
    const withoutPolicies = tables.filter((t) => Number(t.policy_count) === 0)

    console.log(
      `\n${c.bold}Sema:${c.reset} ${tables.length} tablo · ${indexes.length} indeks · ` +
        `${functions.length} fonksiyon · ${triggers.length} trigger`,
    )

    if (withoutRls.length > 0) {
      exitCode = 1
      console.log(
        `${c.red}✗ RLS acilmamis tablolar:${c.reset} ${withoutRls.map((t) => t.table_name).join(', ')}`,
      )
    } else {
      console.log(`${c.green}✓${c.reset} Tum tablolarda RLS acik`)
    }

    if (withoutPolicies.length > 0) {
      exitCode = 1
      console.log(
        `${c.red}✗ Politikasiz tablolar${c.reset} ${c.dim}(RLS acik ama kural yok — hicbir satir okunamaz)${c.reset}: ` +
          withoutPolicies.map((t) => t.table_name).join(', '),
      )
    } else {
      console.log(`${c.green}✓${c.reset} Her tabloda en az bir RLS politikasi var`)
    }

    if (showInspect) {
      console.log(`\n${c.bold}Tablolar${c.reset}`)
      for (const t of tables) {
        console.log(
          `  ${t.table_name.padEnd(26)} rls=${t.rls_enabled ? 'acik' : c.red + 'kapali' + c.reset} ` +
            `politika=${t.policy_count}`,
        )
      }
      console.log(`\n${c.bold}Indeksler${c.reset}`)
      for (const i of indexes) console.log(`  ${i.tablename.padEnd(26)} ${i.indexname}`)
      console.log(`\n${c.bold}Fonksiyonlar${c.reset}`)
      for (const f of functions) console.log(`  ${f.name}(${f.args})`)
      console.log(`\n${c.bold}Trigger'lar${c.reset}`)
      for (const t of triggers) console.log(`  ${t.table_name.padEnd(26)} ${t.trigger_name}`)
    }
  }
} catch (error) {
  exitCode = 1
  console.error(`${c.red}Kosum hatasi:${c.reset}`, error.message)
} finally {
  await harness.stop()
}

process.exit(exitCode)
