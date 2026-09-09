import {
  MAX_DIFFICULTY,
  MAX_OPTIONS,
  MIN_DIFFICULTY,
  MIN_OPTIONS,
  OPTION_KEYS,
  optionColumn,
  parseOptionKey,
  type OptionKey,
  type QuestionOption,
} from '@/lib/admin/questions/options'
import type { RawRow, SourceRow } from './csv'

/**
 * Toplu soru içe aktarmanın doğrulayıcısı — TAMAMEN SAF.
 *
 * Ne Supabase, ne `Date.now()`, ne dosya okuma. Girdi ham satırlar + bilinen
 * konu slug'ları; çıktı içeri alınabilecek satırlar ve SATIR BAZLI hata listesi
 * (spec §M15: "satır bazlı hata raporu"). Yazma katmanı bu sonucu olduğu gibi
 * kullanır; kural burada, tek yerde durur ve testle çivilenir.
 *
 * Bir satırda birden çok sorun varsa HEPSİ raporlanır: editörün dosyayı tek
 * turda düzeltebilmesi için. Sorunlu satır asla `valid` listesine girmez.
 */

/**
 * Sütunlar ve SIRALARI spec §M15'te birebir sayılmıştır:
 *   stem, option_a..e, correct, explanation, topic_slug, difficulty, expected_seconds
 * Şablon da bu sıradan üretilir. Okuma sırası önemsemez (başlıkla eşlenir),
 * ama insan gözüyle bakılan şablonda spec'in sırasından sapmamak gerekir.
 */
export const IMPORT_COLUMNS = [
  'stem',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'correct',
  'explanation',
  'topic_slug',
  'difficulty',
  'expected_seconds',
] as const

export type ImportColumn = (typeof IMPORT_COLUMNS)[number]

/** Bunlar olmadan hiçbir satır anlamlandırılamaz. */
export const REQUIRED_COLUMNS = ['stem', 'option_a', 'option_b', 'correct', 'topic_slug'] as const

export const OPTIONAL_COLUMNS = IMPORT_COLUMNS.filter(
  (column) => !(REQUIRED_COLUMNS as readonly string[]).includes(column),
)

/** `difficulty` boş bırakıldığında kullanılan değer (tablo varsayılanıyla aynı). */
export const DEFAULT_DIFFICULTY = 3

/** İçeri alınmaya hazır, doğrulanmış satır. */
export type ImportRow = {
  /** 1 tabanlı kaynak satır numarası; hata raporuyla aynı numaralandırma. */
  line: number
  stem: string
  options: QuestionOption[]
  correctOption: OptionKey
  explanation: string | null
  topicSlug: string
  /** `topics` sözlüğünden çözülmüş konu kimliği. */
  topicId: string
  difficulty: number
  expectedSeconds: number | null
}

/** Tek bir sorun. `column` null ise sorun satırın bütününe aittir. */
export type RowError = {
  line: number
  column: string | null
  message: string
}

export type ParseResult = {
  valid: ImportRow[]
  errors: RowError[]
}

export type ParseInput = {
  rows: readonly SourceRow[]
  /** Dosyada bulunan normalleştirilmiş sütun adları. */
  columns: readonly string[]
  /** Bilinen konu slug'ı → konu kimliği. Bilinmeyen slug satırı reddeder. */
  topics: Readonly<Record<string, string>>
  /** Başlığın satır numarası; eksik sütun hatası buraya iliştirilir. */
  headerLine?: number | null
}

/**
 * Satırları doğrular.
 *
 * ZORUNLU SÜTUN EKSİKSE hiçbir satır doğrulanmaz: her satır aynı hatayı
 * tekrarlardı ve rapor okunamaz hâle gelirdi. Bunun yerine tek bir başlık
 * hatası döner.
 */
export function parseImportRows(input: ParseInput): ParseResult {
  const present = new Set(input.columns)
  const headerLine = input.headerLine ?? 1

  const missing = REQUIRED_COLUMNS.filter((column) => !present.has(column))
  if (missing.length > 0) {
    return {
      valid: [],
      errors: missing.map((column) => ({
        line: headerLine,
        column,
        message: `Zorunlu sütun eksik: "${column}".`,
      })),
    }
  }

  const valid: ImportRow[] = []
  const errors: RowError[] = []
  /** Aynı dosyada tekrarlanan soruyu yakalamak için: imza → ilk görüldüğü satır. */
  const seen = new Map<string, number>()

  for (const source of input.rows) {
    const rowErrors: RowError[] = []
    const row = source.data
    const line = source.line

    const stem = text(row.stem)
    if (stem === '') {
      rowErrors.push({ line, column: 'stem', message: 'Soru kökü boş olamaz.' })
    }

    const { options, error: optionsError } = readOptionColumns(row, line)
    if (optionsError) rowErrors.push(optionsError)

    const correct = readCorrect(row.correct, options, line)
    if ('error' in correct) rowErrors.push(correct.error)

    const topicSlug = text(row.topic_slug)
    let topicId: string | null = null
    if (topicSlug === '') {
      rowErrors.push({ line, column: 'topic_slug', message: 'Konu kodu (topic_slug) boş olamaz.' })
    } else {
      topicId = input.topics[topicSlug] ?? null
      if (topicId === null) {
        rowErrors.push({
          line,
          column: 'topic_slug',
          message: `Konu bulunamadı: "${topicSlug}". Müfredattaki konu kodlarından birini yazın.`,
        })
      }
    }

    const difficulty = readDifficulty(row.difficulty, line)
    if ('error' in difficulty) rowErrors.push(difficulty.error)

    const expectedSeconds = readExpectedSeconds(row.expected_seconds, line)
    if ('error' in expectedSeconds) rowErrors.push(expectedSeconds.error)

    // Kopya denetimi, satır başka bir nedenle düşse bile yapılır: aynı soruyu
    // iki kez düzeltip iki kez eklemek en can sıkıcı sonuçtur.
    if (stem !== '' && topicSlug !== '') {
      // Ayraç U+0000: hiçbir slug ya da soru kökünde bulunamaz, yani iki
      // farklı satırın imzası asla çakışmaz. Kaynakta KAÇIŞ DİZİSİ olarak
      // yazılır: ham NUL baytı taşıyan dosyayı git ve grep ikili (binary)
      // sayar, değişikliğini göstermez.
      const signature = `${topicSlug}\u0000${collapse(stem)}`
      const first = seen.get(signature)
      if (first === undefined) {
        seen.set(signature, line)
      } else {
        rowErrors.push({
          line,
          column: 'stem',
          message: `Bu soru dosyada zaten var (${first}. satır). Tekrarlanan satır içeri alınmaz.`,
        })
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      continue
    }

    // Buraya gelen satırda hata yok; dar tipler güvenle daraltılabilir.
    valid.push({
      line,
      stem,
      options,
      correctOption: (correct as { key: OptionKey }).key,
      explanation: nullable(row.explanation),
      topicSlug,
      topicId: topicId as string,
      difficulty: (difficulty as { value: number }).value,
      expectedSeconds: (expectedSeconds as { value: number | null }).value,
    })
  }

  return { valid, errors }
}

/**
 * `option_a`…`option_e` sütunlarını okur.
 *
 * KURAL: şıklar baştan sırayla doldurulur. 4 şıklı soru geçerlidir (spec: 4 de
 * 5 de olur), ama A ve C dolu, B boş bir satır kabul edilmez — hangi şıkkın
 * kastedildiği belirsizdir ve öğrenciye "A, B" olarak gösterilirdi.
 */
function readOptionColumns(
  row: RawRow,
  line: number,
): { options: QuestionOption[]; error: RowError | null } {
  const options: QuestionOption[] = []
  let sawEmpty: OptionKey | null = null

  for (const key of OPTION_KEYS) {
    const column = optionColumn(key)
    const value = text(row[column])

    if (value === '') {
      if (sawEmpty === null) sawEmpty = key
      continue
    }

    if (sawEmpty !== null) {
      return {
        options,
        error: {
          line,
          column: optionColumn(sawEmpty),
          message: `Şıklar sırayla doldurulmalı: "${optionColumn(sawEmpty)}" boşken "${column}" dolu.`,
        },
      }
    }

    options.push({ key, text: value })
  }

  if (options.length < MIN_OPTIONS) {
    return {
      options,
      error: {
        line,
        column: 'option_b',
        message: `Soru en az ${MIN_OPTIONS}, en fazla ${MAX_OPTIONS} şık içermeli; ${options.length} şık bulundu.`,
      },
    }
  }

  return { options, error: null }
}

function readCorrect(
  value: unknown,
  options: readonly QuestionOption[],
  line: number,
): { key: OptionKey } | { error: RowError } {
  const raw = text(value)
  if (raw === '') {
    return { error: { line, column: 'correct', message: 'Doğru şık (correct) boş olamaz.' } }
  }

  const key = parseOptionKey(raw)
  if (!key) {
    return {
      error: {
        line,
        column: 'correct',
        message: `Doğru şık A-${OPTION_KEYS[OPTION_KEYS.length - 1]} arasında bir harf olmalı; "${raw}" okundu.`,
      },
    }
  }

  const target = options.find((option) => option.key === key)
  if (!target) {
    return {
      error: {
        line,
        column: 'correct',
        message: `Doğru şık "${key}" için ${optionColumn(key)} sütunu boş; dolu bir şık seçin.`,
      },
    }
  }

  return { key }
}

function readDifficulty(value: unknown, line: number): { value: number } | { error: RowError } {
  const raw = text(value)
  if (raw === '') return { value: DEFAULT_DIFFICULTY }

  const parsed = Number(raw.replace(',', '.'))
  if (!Number.isInteger(parsed) || parsed < MIN_DIFFICULTY || parsed > MAX_DIFFICULTY) {
    return {
      error: {
        line,
        column: 'difficulty',
        message: `Zorluk ${MIN_DIFFICULTY} ile ${MAX_DIFFICULTY} arasında bir tam sayı olmalı; "${raw}" okundu.`,
      },
    }
  }
  return { value: parsed }
}

function readExpectedSeconds(
  value: unknown,
  line: number,
): { value: number | null } | { error: RowError } {
  const raw = text(value)
  if (raw === '') return { value: null }

  const parsed = Number(raw.replace(',', '.'))
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      error: {
        line,
        column: 'expected_seconds',
        message: `Beklenen süre saniye cinsinden pozitif bir tam sayı olmalı; "${raw}" okundu.`,
      },
    }
  }
  return { value: parsed }
}

/** Hücreyi kırpılmış metne çevirir; `null`/`undefined`/sayı hepsi kabul. */
function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function nullable(value: unknown): string | null {
  const result = text(value)
  return result === '' ? null : result
}

/** Kopya karşılaştırması için boşlukları tekleştirir; biçim farkı kopyayı gizlemesin. */
function collapse(value: string): string {
  return value.replace(/\s+/g, ' ')
}
