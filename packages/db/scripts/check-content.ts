#!/usr/bin/env tsx
/**
 * `pnpm --filter @zihin/db check:content` — seed içeriğini doğrular.
 *
 * İçerik dosyaları elle ya da toplu üretimle yazıldığı için, veritabanına
 * girmeden ÖNCE burada denetlenir. Şartnamedeki sayısal kurallar (12 soru,
 * 2/4/4/2 zorluk dağılımı, 5 kart, 2 video) ve tutarlılık kuralları
 * (doğru şık gerçekten şıklar arasında mı, checkpoint videonun içinde mi)
 * tek tek kontrol edilir.
 *
 * Kullanım:
 *   pnpm --filter @zihin/db check:content
 *   tsx scripts/check-content.ts --quiet     # yalnızca hataları göster
 */
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { SeedSubjectContent } from '../seed/types'

const HERE = dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = join(HERE, '..', 'seed', 'content')
const quiet = process.argv.includes('--quiet')

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
}

/** Şartnamenin zorunlu kıldığı sayılar. */
const RULES = {
  questionsPerTopic: 12,
  difficultySplit: { 2: 2, 3: 4, 4: 4, 5: 2 } as Record<number, number>,
  flashcardsPerTopic: 5,
  videosPerTopic: 2,
  checkpointsPerVideo: 2,
  minMemoryNoteSentences: 5,
  /** LGS 4 şık, diğer sınavlar 5 şık. */
  optionCount: { LGS: 4, TYT: 5, AYT: 5, KPSS_LISANS: 5 } as Record<string, number>,
}

type Problem = { file: string; topic: string; message: string }
const problems: Problem[] = []
const keyTally: Record<string, number> = {}

let topicCount = 0
let questionCount = 0
let cardCount = 0
let videoCount = 0

function fail(file: string, topic: string, message: string) {
  problems.push({ file, topic, message })
}

/** Cümle sayısını kabaca ölçer — nokta/ünlem/soru işareti sonrası boşluk. */
function sentenceCount(text: string): number {
  const stripped = text.replace(/\s+/g, ' ').trim()
  if (!stripped) return 0
  return stripped.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0).length
}

async function checkFile(fileName: string) {
  const path = join(CONTENT_DIR, fileName)
  let mod: { content?: SeedSubjectContent }
  try {
    mod = (await import(pathToFileURL(path).href)) as { content?: SeedSubjectContent }
  } catch (error) {
    fail(fileName, '-', `dosya yüklenemedi: ${(error as Error).message}`)
    return
  }

  const content = mod.content
  if (!content) {
    fail(fileName, '-', '`content` adlı bir dışa aktarım bulunamadı')
    return
  }

  const expectedOptions = RULES.optionCount[content.examCode]
  if (!expectedOptions) {
    fail(fileName, '-', `bilinmeyen examCode: ${content.examCode}`)
    return
  }

  for (const unit of content.units) {
    for (const topic of unit.topics) {
      topicCount++
      const where = `${topic.slug}`

      // --- hafıza notu -----------------------------------------------------
      const sentences = sentenceCount(topic.memoryNote ?? '')
      if (sentences < RULES.minMemoryNoteSentences) {
        fail(
          fileName,
          where,
          `hafıza notu ${sentences} cümle (en az ${RULES.minMemoryNoteSentences})`,
        )
      }

      // --- sorular ---------------------------------------------------------
      const questions = topic.questions ?? []
      questionCount += questions.length
      if (questions.length !== RULES.questionsPerTopic) {
        fail(fileName, where, `${questions.length} soru (beklenen ${RULES.questionsPerTopic})`)
      }

      const split: Record<number, number> = {}
      for (const q of questions) split[q.difficulty] = (split[q.difficulty] ?? 0) + 1
      const splitOk = Object.entries(RULES.difficultySplit).every(
        ([d, n]) => (split[Number(d)] ?? 0) === n,
      )
      if (!splitOk) {
        const actual = [2, 3, 4, 5].map((d) => `${d}:${split[d] ?? 0}`).join(' ')
        fail(fileName, where, `zorluk dağılımı yanlış — ${actual} (beklenen 2:2 3:4 4:4 5:2)`)
      }

      questions.forEach((q, qi) => {
        const keys = q.options.map((o) => o.key)
        if (new Set(keys).size !== keys.length) {
          fail(fileName, where, `soru ${qi + 1}: tekrar eden şık anahtarı`)
        }
        if (keys.length !== expectedOptions) {
          fail(
            fileName,
            where,
            `soru ${qi + 1}: ${keys.length} şık (${content.examCode} için ${expectedOptions} olmalı)`,
          )
        }
        if (!keys.includes(q.correctOption)) {
          fail(
            fileName,
            where,
            `soru ${qi + 1}: correctOption "${q.correctOption}" şıklar arasında yok`,
          )
        } else {
          keyTally[q.correctOption] = (keyTally[q.correctOption] ?? 0) + 1
        }
        if (!q.stem?.trim()) fail(fileName, where, `soru ${qi + 1}: boş soru kökü`)
        if (!q.explanation?.trim()) fail(fileName, where, `soru ${qi + 1}: açıklama yok`)
        if (q.expectedSeconds <= 0) {
          fail(fileName, where, `soru ${qi + 1}: expectedSeconds geçersiz (${q.expectedSeconds})`)
        }
        if (q.options.some((o) => !o.text?.trim())) {
          fail(fileName, where, `soru ${qi + 1}: boş şık metni`)
        }
      })

      // --- kartlar ---------------------------------------------------------
      const cards = topic.flashcards ?? []
      cardCount += cards.length
      if (cards.length !== RULES.flashcardsPerTopic) {
        fail(fileName, where, `${cards.length} hafıza kartı (beklenen ${RULES.flashcardsPerTopic})`)
      }
      cards.forEach((card, i) => {
        if (!card.front?.trim() || !card.back?.trim()) {
          fail(fileName, where, `kart ${i + 1}: ön ya da arka yüz boş`)
        }
      })

      // --- videolar --------------------------------------------------------
      const videos = topic.videos ?? []
      videoCount += videos.length
      if (videos.length !== RULES.videosPerTopic) {
        fail(fileName, where, `${videos.length} video (beklenen ${RULES.videosPerTopic})`)
      }
      videos.forEach((v, vi) => {
        if (v.durationSeconds <= 0) {
          fail(fileName, where, `video ${vi + 1}: süre geçersiz`)
        }
        const cps = v.checkpoints ?? []
        if (cps.length !== RULES.checkpointsPerVideo) {
          fail(
            fileName,
            where,
            `video ${vi + 1}: ${cps.length} checkpoint (beklenen ${RULES.checkpointsPerVideo})`,
          )
        }
        const stamps = new Set<number>()
        cps.forEach((cp, ci) => {
          if (cp.questionIndex < 0 || cp.questionIndex >= questions.length) {
            fail(
              fileName,
              where,
              `video ${vi + 1} checkpoint ${ci + 1}: questionIndex ${cp.questionIndex} aralık dışı`,
            )
          }
          if (cp.timestampSeconds <= 0 || cp.timestampSeconds >= v.durationSeconds) {
            fail(
              fileName,
              where,
              `video ${vi + 1} checkpoint ${ci + 1}: zaman ${cp.timestampSeconds}s videonun (${v.durationSeconds}s) dışında`,
            )
          }
          if (stamps.has(cp.timestampSeconds)) {
            fail(fileName, where, `video ${vi + 1}: iki checkpoint aynı saniyede`)
          }
          stamps.add(cp.timestampSeconds)
        })
      })

      // --- kazanımlar ------------------------------------------------------
      const outcomes = topic.outcomes ?? []
      if (outcomes.length < 2) {
        fail(fileName, where, `${outcomes.length} kazanım (en az 2 olmalı)`)
      }
      const outcomeCodes = new Set(outcomes.map((o) => o.code))
      for (const q of questions) {
        if (q.outcomeCode && !outcomeCodes.has(q.outcomeCode)) {
          fail(fileName, where, `soru, tanımsız kazanıma bağlı: ${q.outcomeCode}`)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------

if (!existsSync(CONTENT_DIR)) {
  console.log(`${c.yellow}!${c.reset} ${CONTENT_DIR} yok — henüz içerik üretilmemiş.`)
  process.exit(0)
}

const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.ts'))

if (files.length === 0) {
  console.log(`${c.yellow}!${c.reset} seed/content altında .ts dosyası yok.`)
  process.exit(0)
}

for (const file of files) await checkFile(file)

// --- rapor -----------------------------------------------------------------
const byFile = new Map<string, Problem[]>()
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, [])
  byFile.get(p.file)!.push(p)
}

if (!quiet || problems.length > 0) {
  for (const [file, list] of byFile) {
    console.log(`\n${c.red}✗ ${file}${c.reset}`)
    for (const p of list) console.log(`   ${c.dim}${p.topic}${c.reset}  ${p.message}`)
  }
}

const totalKeys = Object.values(keyTally).reduce((a, b) => a + b, 0)
const spread = Object.entries(keyTally)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, n]) => `${k}:${n} (%${((n / Math.max(1, totalKeys)) * 100).toFixed(0)})`)
  .join('  ')

console.log(
  `\n${c.bold}İçerik:${c.reset} ${files.length} dosya · ${topicCount} konu · ` +
    `${questionCount} soru · ${cardCount} kart · ${videoCount} video`,
)
console.log(`${c.bold}Doğru şık dağılımı:${c.reset} ${spread}`)

// Tek bir şıkkın belirgin şekilde ağır basması, soruların kalıplaştığını gösterir.
const keys = Object.values(keyTally)
if (keys.length > 0 && totalKeys >= 24) {
  const maxShare = Math.max(...keys) / totalKeys
  const expected = 1 / keys.length
  if (maxShare > expected * 1.6) {
    console.log(
      `${c.yellow}!${c.reset} Doğru şıklar dengesiz dağılmış (en sık şık %${(maxShare * 100).toFixed(0)}). ` +
        `Öğrenci kalıbı fark edebilir.`,
    )
  }
}

if (problems.length > 0) {
  console.log(`\n${c.red}${c.bold}${problems.length} sorun bulundu.${c.reset}`)
  process.exit(1)
}

console.log(`\n${c.green}${c.bold}Tüm içerik kurallara uygun.${c.reset}`)
