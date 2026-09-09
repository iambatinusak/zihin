/**
 * Test çözme arayüzünün saf mantığı.
 *
 * Burada ne React, ne Supabase, ne de `Date.now()` vardır: "şimdi" her zaman
 * parametre olarak gelir. Sebebi pratik — arka uç Docker'sız koşmadığı için
 * sayaç, ızgara durumu ve klavye eşlemesi yalnızca birim testleriyle güvence
 * altına alınabiliyor (bkz. `runner-state.test.ts`).
 *
 * `packages/core` yerine burada durur: bunlar uygulamaya özgü sunum
 * kararlarıdır, iş mantığı değil (CONVENTIONS §5).
 */

/** Süreli testte kalan saniye. Süresiz testte null. */
export function remainingSeconds(
  startedAt: string,
  durationSeconds: number | null,
  now: number,
): number | null {
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null
  }
  const start = Date.parse(startedAt)
  // Okunamayan bir başlangıç damgasında sayaç gösterilmez; yanlış bir sayaç
  // göstermektense hiç göstermemek doğrudur (testi kendiliğinden bitirebilirdi).
  if (Number.isNaN(start)) return null

  const deadline = start + durationSeconds * 1000
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

/** Saniyeyi ss:dd ya da s:dd:ss biçiminde yazar. Negatif değerler 0 sayılır. */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.trunc(seconds) : 0
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const rest = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`
}

/** Uyarı eşikleri: 5 dakika ve 1 dakika kala (spec §9.8). */
export const TIME_WARNING_THRESHOLDS = [300, 60] as const

/**
 * Sayaç bu tikte bir uyarı eşiğini geçti mi? Geçtiyse eşiği (saniye), yoksa
 * null döner. Eşiğin ÜSTÜNDEN altına inme anı aranır; böylece sayfa 4 dakika
 * kala açılırsa 5 dakika uyarısı geç gelmez ve her tikte tekrarlanmaz.
 */
export function crossedWarning(previous: number, current: number): number | null {
  for (const threshold of TIME_WARNING_THRESHOLDS) {
    if (previous > threshold && current <= threshold) return threshold
  }
  return null
}

/**
 * Klavyeden şık seçimi: "1"-"9" tuşları sıfır tabanlı şık indeksine çevrilir.
 * Sayısal tuş takımı da aynı `key` değerini üretir. Başka her tuş null döner.
 */
export function optionIndexFromKey(key: string): number | null {
  if (key.length !== 1) return null
  const code = key.charCodeAt(0)
  if (code < 49 || code > 57) return null
  return code - 49
}

/** Boş bırakılmış soru sayısı. Şıkkı geri alınmış soru da boştur. */
export function blankCount(
  order: readonly string[],
  answers: ReadonlyMap<string, string | null>,
): number {
  let blank = 0
  for (const questionId of order) {
    const answer = answers.get(questionId)
    if (answer === undefined || answer === null) blank += 1
  }
  return blank
}

/** Cevaplanmış soruların kimlikleri — `nextUnanswered` bunu bekler. */
export function answeredIds(
  order: readonly string[],
  answers: ReadonlyMap<string, string | null>,
): Set<string> {
  const ids = new Set<string>()
  for (const questionId of order) {
    const answer = answers.get(questionId)
    if (answer !== undefined && answer !== null) ids.add(questionId)
  }
  return ids
}

export type CellStatus = 'flagged' | 'answered' | 'blank'

/**
 * Izgara hücresinin durumu.
 *
 * İŞARETLİ, CEVAPLIYA BASKINDIR: işaret "buraya geri dön" demektir, cevabın
 * varlığından daha çok bilgi taşır. Renk tek başına anlam taşımaz; çağıran
 * taraf her duruma ayrı bir simge/şekil ve `aria-label` verir (CONVENTIONS §8).
 */
export function cellStatus(
  questionId: string,
  answers: ReadonlyMap<string, string | null>,
  flagged: ReadonlySet<string>,
): CellStatus {
  if (flagged.has(questionId)) return 'flagged'
  const answer = answers.get(questionId)
  return answer === undefined || answer === null ? 'blank' : 'answered'
}

/** İndeksi listenin içine sarar (başa/sona dönüş). Boş listede 0 döner. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}
