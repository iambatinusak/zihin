/**
 * Şık (option) kuralları — SAF.
 *
 * Hem soru düzenleyici (tarayıcı) hem toplu içe aktarma (sunucu) aynı kuralları
 * kullanır. Veritabanı tarafındaki karşılıkları:
 *   - `questions_options_check`      → dizi ve 2-5 eleman,
 *   - `validate_question_options()`  → `correct_option`, `options[].key` içinde olmalı.
 * Buradaki denetimler o kısıtları TEKRARLAR; amaç kullanıcıya ham Postgres
 * hatası yerine Türkçe ve alan bazlı bir mesaj verebilmektir.
 */

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const
export type OptionKey = (typeof OPTION_KEYS)[number]

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = OPTION_KEYS.length

export const MIN_DIFFICULTY = 1
export const MAX_DIFFICULTY = 5

export type QuestionOption = { key: OptionKey; text: string }

export function isOptionKey(value: unknown): value is OptionKey {
  return typeof value === 'string' && (OPTION_KEYS as readonly string[]).includes(value)
}

/**
 * Serbest metinden şık anahtarı okur.
 *
 * Kabul edilen yazımlar: `A`, `a`, `A)`, `A.`, `option_a`, `option a`, `şık a`.
 * CSV'ler elle doldurulduğu için bu esneklik gereklidir; bulunamazsa `null`.
 *
 * Not: `toUpperCase()` KULLANILMAZ. Türkçe yerel ayarda `i → İ` dönüşümü
 * beklenmedik sonuç verir; harf zaten yalnızca A-E olabildiği için eşleme
 * doğrudan yapılır.
 */
export function parseOptionKey(value: unknown): OptionKey | null {
  if (typeof value !== 'string') return null
  const match = /^(?:option[_\s-]?|ş[ıi]k[_\s-]?)?([a-eA-E])[).\s]*$/.exec(value.trim())
  const letter = match?.[1]
  if (!letter) return null
  const upper = ASCII_UPPER[letter]
  return upper ?? null
}

const ASCII_UPPER: Record<string, OptionKey> = {
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  e: 'E',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
}

/** `option_a`…`option_e` sütun adları — CSV başlığı ve şablon aynı kaynaktan. */
export function optionColumn(key: OptionKey): string {
  return `option_${key.toLowerCase()}`
}

/**
 * Şıkları normalleştirir: metinleri kırpar, boşları atar ve anahtarları
 * baştan (A, B, C…) yeniden verir.
 *
 * Yeniden anahtarlama bilinçli: düzenleyicide ortadaki bir şık silindiğinde
 * geriye A, C, D kalırdı; öğrenciye A, B, C göstermek ve doğru şıkkı ona göre
 * taşımak tek tutarlı davranıştır.
 */
export function normalizeOptions(options: readonly { key?: string; text: string }[]): {
  options: QuestionOption[]
  /** Eski anahtar → yeni anahtar; `correctOption` bununla taşınır. */
  keyMap: Record<string, OptionKey>
} {
  const keyMap: Record<string, OptionKey> = {}
  const result: QuestionOption[] = []

  for (const option of options) {
    const text = option.text.trim()
    if (text === '') continue
    const next = OPTION_KEYS[result.length]
    if (!next) break
    if (option.key) keyMap[option.key] = next
    result.push({ key: next, text })
  }

  return { options: result, keyMap }
}

export type OptionsProblem =
  | { kind: 'too_few' }
  | { kind: 'too_many' }
  | { kind: 'correct_missing' }
  | { kind: 'correct_empty'; key: OptionKey }

/**
 * Şık kümesini ve doğru şıkkı birlikte denetler.
 * `null` dönerse kayıt veritabanı kısıtlarını geçer.
 */
export function validateOptions(
  options: readonly QuestionOption[],
  correctOption: string | null | undefined,
): OptionsProblem | null {
  const filled = options.filter((option) => option.text.trim() !== '')

  if (filled.length < MIN_OPTIONS) return { kind: 'too_few' }
  if (options.length > MAX_OPTIONS) return { kind: 'too_many' }

  const key = parseOptionKey(correctOption)
  if (!key) return { kind: 'correct_missing' }

  const target = options.find((option) => option.key === key)
  if (!target) return { kind: 'correct_missing' }
  if (target.text.trim() === '') return { kind: 'correct_empty', key }

  return null
}

/**
 * Veritabanındaki `options` (jsonb) değerini güvenle okur.
 * Beklenmeyen bir şekil geldiğinde boş dizi döner — düzenleyici çökmez,
 * editör şıkları yeniden girer.
 */
export function readOptions(value: unknown): QuestionOption[] {
  if (!Array.isArray(value)) return []
  const result: QuestionOption[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const key = parseOptionKey(record.key)
    const text = typeof record.text === 'string' ? record.text : null
    if (!key || text === null) continue
    result.push({ key, text })
  }

  return result
}

/** Zorluk değerinin 1-5 aralığında bir tam sayı olup olmadığı. */
export function isValidDifficulty(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_DIFFICULTY && value <= MAX_DIFFICULTY
}
