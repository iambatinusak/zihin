import { DEFAULT_EXPECTED_SECONDS } from '@zihin/core'
import type { AttemptLike, MasteryStatus } from '@zihin/core'

/**
 * Yetkinlik motorunun saf (veritabanısız) yardımcıları.
 *
 * Bu dosya bilinçli olarak `server-only` DEĞİLDİR ve Supabase tanımaz: tek işi
 * satır → core girdisi dönüşümü ve durum geçişi kararı. Böylece Docker olmadan
 * doğrudan test edilebilir.
 */

/**
 * `attempts` satırının yetkinlik hesabı için gereken hâli — soru tablosundan
 * gelen `difficulty` / `expected_seconds` ile birlikte.
 */
export type MasteryAttemptRow = {
  question_id: string
  is_correct: boolean
  time_spent_ms: number
  answered_at: string
  repeat_index: number
  /** Soru satırı okunamadıysa null olabilir; orta zorluk varsayılır. */
  difficulty: number | null
  /** Soruda tanımlı değilse null; zorluktan türetilen varsayılan kullanılır. */
  expected_seconds: number | null
}

/** `questions.difficulty` okunamadığında kullanılan orta zorluk (şema varsayılanı). */
export const FALLBACK_DIFFICULTY = 3

/**
 * Bir deneme satırını core'un `AttemptLike` sözleşmesine çevirir.
 *
 * `expected_seconds` null ise değer BURADA `DEFAULT_EXPECTED_SECONDS(difficulty)`
 * ile doldurulur. Core zaten aynı varsayımı yapıyor; açıkça çözmemizin sebebi
 * hesabın girdisinin loglanabilir ve test edilebilir olması.
 */
export function toAttemptLike(row: MasteryAttemptRow): AttemptLike {
  const difficulty =
    row.difficulty !== null && Number.isFinite(row.difficulty)
      ? row.difficulty
      : FALLBACK_DIFFICULTY

  const declared = row.expected_seconds
  const expectedSeconds =
    declared !== null && Number.isFinite(declared) && declared > 0
      ? declared
      : DEFAULT_EXPECTED_SECONDS(difficulty)

  return {
    questionId: row.question_id,
    isCorrect: row.is_correct,
    difficulty,
    timeSpentMs: row.time_spent_ms,
    expectedSeconds,
    answeredAt: row.answered_at,
    repeatIndex: row.repeat_index,
  }
}

export function toAttemptLikes(rows: MasteryAttemptRow[]): AttemptLike[] {
  return rows.map(toAttemptLike)
}

/**
 * "Zayıftan güçlüye" geçişi saptar — `weak_to_strong` rozetinin (Faz 6) tetiği.
 *
 * Yalnızca `weak → strong` sayılır. `unknown → strong` sayılmaz: orada bir
 * gelişme değil, ilk kez ölçüm yapılmış olması vardır.
 */
export function isWeakToStrongTransition(
  previousStatus: MasteryStatus | null,
  nextStatus: MasteryStatus,
): boolean {
  return previousStatus === 'weak' && nextStatus === 'strong'
}

/** Aynı konu iki kez gelirse tek sefer hesaplansın; sıra korunur. */
export function dedupeTopicIds(topicIds: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of topicIds) {
    if (id.length === 0 || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}
