import { buildQuestionOrder } from '@/lib/test-engine/session'

/**
 * Seviye tespit sınavının soru seçimi (spec §M7).
 *
 * Bu dosya SAF'tır: Supabase'i, Next.js'i ve sistem saatini tanımaz. Sebep
 * pratik — arka uç Docker'sız koşmuyor, dolayısıyla dağıtımın doğruluğu
 * yalnızca birim testleriyle güvence altına alınabiliyor (CONVENTIONS §5).
 *
 * Kural sırası (çakıştıklarında ÜSTTEKİ kazanır):
 *   1. Toplam 20-30 soru.
 *   2. Sorusu olan her dersten en az 2 soru.
 *   3. Ders başına yumuşak üst sınır 3 soru; yalnızca 20'ye ulaşmak için aşılır.
 *   4. Kalan kontenjan `examWeight` ile orantılı dağıtılır.
 *
 * 2-3 kuralı ile 20-30 kuralı az sayıda derste çakışır: 6 dersli bir sınavda
 * 3'er soru ancak 18 eder. Böyle bir durumda toplam kazanır, çünkü ölçümün
 * güvenilirliği soru sayısına bağlıdır; ders başına dağılım yalnızca dengeyi
 * gözetir. Ters yönde (çok ders) 2'şer soru 30'u aşarsa dağıtım en düşük
 * ağırlıklı dersten başlayarak seyreltilir.
 */

/** Sınavın toplam soru sayısı için alt sınır (spec §M7). */
export const PLACEMENT_MIN_TOTAL = 20
/** Üst sınır. */
export const PLACEMENT_MAX_TOTAL = 30
/** Hedef; havuz yeterliyse bu sayıya oturulur. */
export const PLACEMENT_TARGET_TOTAL = 25
/** Sorusu olan her dersten alınacak en az soru. */
export const PLACEMENT_MIN_PER_SUBJECT = 2
/** Ders başına yumuşak üst sınır; yalnızca alt toplama ulaşmak için aşılır. */
export const PLACEMENT_SOFT_MAX_PER_SUBJECT = 3
/** Sınav süresi: 30 dakika (spec §M7). */
export const PLACEMENT_DURATION_SECONDS = 1800

/** Dağıtım için bir dersin gereken en az bilgisi. */
export type PlacementSubjectLike = {
  subjectId: string
  /**
   * Dersin sınavdaki ağırlığı (negatif olmayan). Ağırlıkların toplamı 0 ise
   * (ya da hiçbiri geçerli sayı değilse) tüm dersler eşit ağırlıklı sayılır.
   */
  examWeight: number
}

export type PlacementSubjectAllocation = {
  subjectId: string
  /** Bu dersten seçilen soru sayısı. */
  count: number
  /** Havuzdaki (tekilleştirilmiş) soru sayısı. */
  available: number
}

export type PlacementSelection = {
  /** Sorulacak sorular, ders sırasına göre gruplanmış hâlde. */
  questionIds: string[]
  bySubject: PlacementSubjectAllocation[]
  total: number
  /** Havuz 20 soruya yetmedi mi? Çağıran kullanıcıyı uyarabilir. */
  short: boolean
}

type Pool = {
  subjectId: string
  weight: number
  ids: string[]
  count: number
}

/**
 * Seviye tespit sınavının sorularını seçer.
 *
 * Aynı `seed` ile aynı çıktıyı verir; tohum verilmezse havuz sırası korunur
 * (yani yine deterministiktir, sadece karıştırılmaz).
 */
export function buildPlacementSelection(
  subjects: readonly PlacementSubjectLike[],
  questionsBySubject: Readonly<Record<string, readonly string[]>>,
  targetTotal: number = PLACEMENT_TARGET_TOTAL,
  options: { seed?: string } = {},
): PlacementSelection {
  const pools = buildPools(subjects, questionsBySubject, options.seed)

  if (pools.length === 0) {
    return { questionIds: [], bySubject: [], total: 0, short: true }
  }

  const capacity = pools.reduce((sum, pool) => sum + pool.ids.length, 0)

  // 1. Taban: her dersten en az 2 (havuz yetmiyorsa havuz kadar).
  for (const pool of pools) {
    pool.count = Math.min(PLACEMENT_MIN_PER_SUBJECT, pool.ids.length)
  }

  let total = sumCounts(pools)

  // Hedef, tabanı üst sınıra kadar BÜYÜTÜR: 13 dersli bir sınavda 2'şer soru
  // 26 eder ve bu zaten 20-30 aralığındadır — hedefi 25'te tutup bir dersi
  // tek soruya düşürmenin anlamı yok. Ancak taban 30'u aşarsa (çok ders)
  // toplam kuralı kazanır ve dağıtım seyreltilir.
  const target = Math.min(
    capacity,
    Math.max(clampTotal(targetTotal), Math.min(total, PLACEMENT_MAX_TOTAL)),
  )

  // 2a. Taban hedefi aşıyorsa (çok dersli sınav) seyrelt.
  while (total > target) {
    const victim = pickHighestCount(pools)
    if (!victim) break
    victim.count -= 1
    total -= 1
  }

  // 2b. Hedefe yer varsa kalanı ağırlığa göre dağıt. Önce yumuşak üst sınıra
  //     (3) kadar; hâlâ eksikse sınır kaldırılıp havuz sonuna kadar gidilir.
  total += distribute(pools, target - total, PLACEMENT_SOFT_MAX_PER_SUBJECT)
  total += distribute(pools, target - total, Number.POSITIVE_INFINITY)

  const questionIds: string[] = []
  const bySubject: PlacementSubjectAllocation[] = []
  for (const pool of pools) {
    questionIds.push(...pool.ids.slice(0, pool.count))
    bySubject.push({ subjectId: pool.subjectId, count: pool.count, available: pool.ids.length })
  }

  return {
    questionIds,
    bySubject,
    total: questionIds.length,
    short: questionIds.length < PLACEMENT_MIN_TOTAL,
  }
}

/* ------------------------------------------------------------------------- *
 * Yardımcılar
 * ------------------------------------------------------------------------- */

function clampTotal(value: number): number {
  if (!Number.isFinite(value)) return PLACEMENT_TARGET_TOTAL
  const rounded = Math.round(value)
  if (rounded < PLACEMENT_MIN_TOTAL) return PLACEMENT_MIN_TOTAL
  if (rounded > PLACEMENT_MAX_TOTAL) return PLACEMENT_MAX_TOTAL
  return rounded
}

/**
 * Havuzları kurar: boş dersler düşer, kimlikler tekilleştirilir ve tohum
 * verilmişse ders bazında karıştırılır.
 *
 * Karıştırma tohumu ders kimliğiyle zenginleştirilir; aksi hâlde iki dersin
 * havuzu aynı uzunluktaysa aynı permütasyonu alırdı.
 */
function buildPools(
  subjects: readonly PlacementSubjectLike[],
  questionsBySubject: Readonly<Record<string, readonly string[]>>,
  seed: string | undefined,
): Pool[] {
  const seen = new Set<string>()
  const pools: Pool[] = []

  for (const subject of subjects) {
    if (seen.has(subject.subjectId)) continue
    seen.add(subject.subjectId)

    const raw = questionsBySubject[subject.subjectId] ?? []
    const ids = dedupe(raw)
    if (ids.length === 0) continue

    pools.push({
      subjectId: subject.subjectId,
      weight: sanitizeWeight(subject.examWeight),
      ids: seed === undefined ? ids : buildQuestionOrder(ids, `${seed}:${subject.subjectId}`),
      count: 0,
    })
  }

  // Hiçbir ağırlık anlamlı değilse eşit dağıtım yapılır — bir dersin ağırlığı
  // girilmemiş olması onu sınav dışı bırakmamalı.
  if (pools.every((pool) => pool.weight === 0)) {
    for (const pool of pools) pool.weight = 1
  }

  return pools
}

function dedupe(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function sanitizeWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0
  return weight
}

function sumCounts(pools: readonly Pool[]): number {
  return pools.reduce((sum, pool) => sum + pool.count, 0)
}

/**
 * Seyreltmede kurban: en çok soruya sahip ders. Eşitlikte en düşük ağırlıklı,
 * o da eşitse kimliği alfabetik olarak sonda olan ders verir — hepsi
 * deterministik, hiçbiri girdi sırasına bağlı değil.
 */
function pickHighestCount(pools: readonly Pool[]): Pool | null {
  let best: Pool | null = null
  for (const pool of pools) {
    if (pool.count === 0) continue
    if (best === null) {
      best = pool
      continue
    }
    if (pool.count > best.count) {
      best = pool
    } else if (pool.count === best.count) {
      if (pool.weight < best.weight) best = pool
      else if (pool.weight === best.weight && pool.subjectId > best.subjectId) best = pool
    }
  }
  return best
}

/**
 * Kalan kontenjanı ağırlığa göre birer birer dağıtır (en büyük artık yöntemi).
 *
 * Her adımda "ideal payından en çok geride kalan" derse bir soru verilir;
 * eşitlik ağırlık, sonra kimlik ile kırılır. Tek tek dağıtmanın sebebi tavan:
 * bir ders havuzunu ya da üst sınırı doldurduğunda payı kendiliğinden diğer
 * derslere akar, ayrı bir düzeltme turu gerekmez.
 *
 * @returns gerçekten dağıtılan soru sayısı
 */
function distribute(pools: readonly Pool[], remaining: number, cap: number): number {
  if (remaining <= 0) return 0

  const totalWeight = pools.reduce((sum, pool) => sum + pool.weight, 0)
  if (totalWeight <= 0) return 0

  // İdeal pay, dağıtımın BAŞINDAKİ mevcut sayılar üzerine eklenecek miktardır.
  const start = new Map(pools.map((pool) => [pool.subjectId, pool.count]))
  const ideal = new Map(
    pools.map((pool) => [pool.subjectId, (remaining * pool.weight) / totalWeight]),
  )

  let given = 0
  while (given < remaining) {
    let best: Pool | null = null
    let bestDeficit = -Infinity

    for (const pool of pools) {
      if (pool.count >= Math.min(cap, pool.ids.length)) continue
      const assigned = pool.count - (start.get(pool.subjectId) ?? 0)
      const deficit = (ideal.get(pool.subjectId) ?? 0) - assigned

      if (best === null || deficit > bestDeficit) {
        best = pool
        bestDeficit = deficit
        continue
      }
      if (deficit === bestDeficit) {
        if (pool.weight > best.weight) {
          best = pool
        } else if (pool.weight === best.weight && pool.subjectId < best.subjectId) {
          best = pool
        }
      }
    }

    if (best === null) break
    best.count += 1
    given += 1
  }

  return given
}
