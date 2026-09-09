import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getDictionary as getFullDictionary } from '@/lib/i18n'
import type { Dictionary } from './core'

import * as adminDict from './admin'
import * as adminQuestionsDict from './admin-questions'
import * as adminMediaDict from './admin-media'
import * as authDict from './auth'
import * as baseDict from './base'
import * as billingDict from './billing'
import * as cardsDict from './cards'
import * as gamificationDict from './gamification'
import * as helpDict from './help'
import * as mockDict from './mock'
import * as notificationsDict from './notifications'
import * as onboardingDict from './onboarding'
import * as parentPanelDict from './parent-panel'
import * as placementDict from './placement'
import * as settingsDict from './settings'
import * as testDict from './test'

/*
 * DAR SÖZLÜK BEKÇİSİ.
 *
 * Client Component'ler tam sözlüğü değil, `lib/i18n/<bölüm>` altındaki dar bir
 * sözlüğü kullanır — tam sözlük 94 kB ve tarayıcıya girmesi anlamsız (bkz.
 * `lib/i18n/core.ts` başlığı). Dar sözlüğün riski sessizdir: eksik bir bölüm,
 * hata vermek yerine anahtarın kendisini ("auth.login") ekrana basar.
 *
 * Bu test o riski kapatır: her Client Component'in kaynağından KULLANDIĞI
 * anahtarlar çıkarılır ve dar sözlükteki karşılığının TAM sözlüktekiyle
 * birebir aynı olduğu doğrulanır. Yeni bir anahtar yanlış bölümden okunursa
 * derleme değil, bu test kırılır.
 */

const WEB_ROOT = path.resolve(__dirname, '../..')

const SCOPES: Record<string, Pick<Dictionary, 't' | 'section'>> = {
  admin: adminDict,
  'admin-media': adminMediaDict,
  'admin-questions': adminQuestionsDict,
  auth: authDict,
  base: baseDict,
  billing: billingDict,
  cards: cardsDict,
  gamification: gamificationDict,
  help: helpDict,
  mock: mockDict,
  notifications: notificationsDict,
  onboarding: onboardingDict,
  'parent-panel': parentPanelDict,
  placement: placementDict,
  settings: settingsDict,
  test: testDict,
}

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(full)
    }
  }
  return out
}

type Usage = { file: string; scope: string; keys: string[] }

function collectUsages(): Usage[] {
  const usages: Usage[] = []
  for (const root of ['components', 'app', 'lib']) {
    for (const file of sourceFiles(path.join(WEB_ROOT, root))) {
      const src = fs.readFileSync(file, 'utf8')
      const importMatch = /from '@\/lib\/i18n\/([a-z-]+)'/.exec(src)
      if (!importMatch) continue
      const scope = importMatch[1] as string
      if (!(scope in SCOPES)) continue
      const keys = new Set<string>()
      for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) keys.add(m[1] as string)
      for (const m of src.matchAll(/\bsection(?:<[\s\S]*?>)?\(\s*'([^']+)'/g))
        keys.add(m[1] as string)
      usages.push({ file: path.relative(WEB_ROOT, file), scope, keys: [...keys] })
    }
  }
  return usages
}

const usages = collectUsages()
const full = getFullDictionary()

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

describe('dar i18n sözlükleri', () => {
  it('taranacak bir şey bulur (regex bozulursa test sessizce geçmesin)', () => {
    expect(usages.length).toBeGreaterThan(50)
    expect(usages.flatMap((u) => u.keys).length).toBeGreaterThan(100)
  })

  it.each(usages.filter((u) => u.keys.length > 0).map((u) => [u.file, u] as const))(
    '%s — kullandığı her anahtar dar sözlükte tam sözlükle aynı',
    (_file, usage) => {
      const scoped = SCOPES[usage.scope] as Pick<Dictionary, 't' | 'section'>
      for (const key of usage.keys) {
        const expected = lookup(full, key)
        // Anahtarın tam sözlükte gerçekten var olması da bir iddiadır.
        expect(expected, `${usage.file}: '${key}' tam sözlükte yok`).toBeDefined()
        expect(scoped.section(key), `${usage.file}: '${key}' dar sözlükte farklı`).toEqual(expected)
      }
    },
  )

  /*
   * Tam sözlük 94 kB. Tarayıcıya üç yoldan girebiliyordu ve üçü de burada
   * kapatılır:
   *   1. Bir Client Component doğrudan '@/lib/i18n' import eder.
   *   2. Next.js'in `loading` / `error` / `not-found` / `template` dosyaları —
   *      bunlar `'use client'` yazmasalar bile rotanın İSTEMCİ paketine girer.
   *      `app/(auth)/onboarding/loading.tsx` tek satırlık bir "Yükleniyor..."
   *      için sözlüğün tamamını indiriyordu.
   *   3. `'use client'` YAZMAYAN ama bir Client Component'in import ettiği ara
   *      modüller (özellik klasörlerindeki `strings.ts`, `wizard-progress.tsx`). Bunlar
   *      istemci grafiğine dahildir; en sinsi sızıntı buydu.
   *
   * Bu yüzden denetim yüzeysel değil, GEÇİŞLİ: istemci köklerinden başlayıp
   * import grafiği yürünür. `'use server'` modülleri istemciye paketlenmez,
   * yürüyüş orada durur.
   */
  const CLIENT_ENTRIES = [
    'loading.tsx',
    'error.tsx',
    'not-found.tsx',
    'template.tsx',
    'global-error.tsx',
  ]

  function readAll(): Map<string, string> {
    const all = new Map<string, string>()
    for (const root of ['app', 'components', 'lib']) {
      for (const file of sourceFiles(path.join(WEB_ROOT, root))) {
        all.set(
          path.relative(WEB_ROOT, file).split(path.sep).join('/'),
          fs.readFileSync(file, 'utf8'),
        )
      }
    }
    return all
  }

  function resolveImport(all: Map<string, string>, from: string, spec: string): string | null {
    let candidate: string
    if (spec.startsWith('@/')) candidate = spec.slice(2)
    else if (spec.startsWith('.'))
      candidate = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec))
    else return null
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      if (all.has(candidate + ext)) return candidate + ext
    }
    return all.has(candidate) ? candidate : null
  }

  it('istemci import grafiğinin hiçbir yerinde tam sözlük yok', () => {
    const all = readAll()
    const isClientEntry = (file: string, src: string) =>
      /^['"]use client['"]/.test(src) || CLIENT_ENTRIES.includes(path.posix.basename(file))

    const stack = [...all].filter(([f, src]) => isClientEntry(f, src)).map(([f]) => f)
    expect(stack.length, 'istemci kökü bulunamadı — tarama bozuk').toBeGreaterThan(50)

    const seen = new Set<string>()
    while (stack.length > 0) {
      const file = stack.pop() as string
      if (seen.has(file)) continue
      seen.add(file)
      for (const m of (all.get(file) as string).matchAll(/from '([^']+)'/g)) {
        const target = resolveImport(all, file, m[1] as string)
        if (!target || seen.has(target)) continue
        // 'use server' modülleri istemciye paketlenmez.
        if (/^['"]use server['"]/.test(all.get(target) as string)) continue
        stack.push(target)
      }
    }

    const offenders = [...seen].filter((f) => /from '@\/lib\/i18n'/.test(all.get(f) as string))
    expect(offenders).toEqual([])
  })

  it('dar sözlük eksik anahtarda anahtarın kendisini döndürür', () => {
    expect(baseDict.t('admin.deleteTitle')).toBe('admin.deleteTitle')
  })
})
