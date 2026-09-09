import type { TopicBreakdown } from '@/lib/test-engine/session'

/**
 * Sonuç ekranının saf mantığı: süre biçimlendirme, başarı yüzdesi, ders
 * kırılımı ve soru süzgeci. Motor (`lib/test-engine/session.ts`) konu bazlı
 * kırılımı üretir; ders bazlı kırılım yalnızca sunum için burada toplanır.
 */

export type DurationUnits = { hour: string; minute: string; second: string }

/**
 * Milisaniyeyi "1 sa 12 dk" gibi okunur bir süreye çevirir.
 *
 * Birim etiketleri parametre olarak alınır ki bu dosya sözlüğe bağlanmasın ve
 * testte sabit girdiyle ölçülebilsin. Bir dakikanın altındaki süreler saniye
 * gösterir; üstündekilerde saniye yutulur — "1 sa 12 dk 07 sn" okunmuyor.
 */
export function formatDurationMs(totalMs: number, units: DurationUnits): string {
  const safe = Number.isFinite(totalMs) && totalMs > 0 ? Math.trunc(totalMs) : 0
  const totalSeconds = Math.round(safe / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours} ${units.hour} ${minutes} ${units.minute}`
  if (minutes > 0) return `${minutes} ${units.minute}`
  return `${seconds} ${units.second}`
}

/** Soru başına ortalama süre (ms). Soru yoksa 0. */
export function averageMs(totalTimeMs: number, total: number): number {
  if (total <= 0) return 0
  const safe = Number.isFinite(totalTimeMs) && totalTimeMs > 0 ? totalTimeMs : 0
  return Math.round(safe / total)
}

/** Başarı yüzdesi: doğru / toplam, 0-100 arası tam sayı. */
export function successPercent(correct: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((Math.max(0, correct) / total) * 100)
}

export type TopicLabel = {
  topicId: string
  topicTitle: string
  subjectId: string
  subjectName: string
}

export type SubjectBreakdown = {
  subjectId: string
  subjectName: string
  total: number
  correct: number
  wrong: number
  blank: number
}

/**
 * Konu kırılımını derse göre toplar. Etiketi bulunamayan konular tek bir
 * "diğer" grubunda toplanır — etiket eksik diye satır kaybolmaz.
 *
 * Net BURADA TOPLANMAZ: net katsayıya bağlı bir orandır, konu netlerinin
 * toplamı ders netini vermez. Ders satırında doğru/yanlış/boş gösterilir.
 */
export function groupBySubject(
  byTopic: readonly TopicBreakdown[],
  labels: ReadonlyMap<string, TopicLabel>,
  fallbackName: string,
): SubjectBreakdown[] {
  const groups = new Map<string, SubjectBreakdown>()

  for (const topic of byTopic) {
    const label = labels.get(topic.topicId)
    const subjectId = label?.subjectId ?? '__other__'
    const subjectName = label?.subjectName ?? fallbackName
    const group = groups.get(subjectId) ?? {
      subjectId,
      subjectName,
      total: 0,
      correct: 0,
      wrong: 0,
      blank: 0,
    }
    group.total += topic.total
    group.correct += topic.correct
    group.wrong += topic.wrong
    group.blank += topic.blank
    groups.set(subjectId, group)
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName, 'tr'),
  )
}

export type ReviewFilter = 'all' | 'wrong' | 'blank'

export type ReviewFilterable = {
  selectedOption: string | null
  isCorrect: boolean
}

/**
 * Soru çözümleri süzgeci. "Yanlışlarım" boş bırakılanları İÇERMEZ: boş bırakmak
 * yanlış cevaplamak değildir ve ikisinin çalışma sonucu farklıdır.
 */
export function filterReview<T extends ReviewFilterable>(
  questions: readonly T[],
  filter: ReviewFilter,
): T[] {
  if (filter === 'all') return [...questions]
  if (filter === 'blank') return questions.filter((question) => question.selectedOption === null)
  return questions.filter((question) => question.selectedOption !== null && !question.isCorrect)
}
