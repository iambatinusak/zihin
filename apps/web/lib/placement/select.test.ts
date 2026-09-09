import { describe, expect, it } from 'vitest'
import {
  buildPlacementSelection,
  PLACEMENT_MAX_TOTAL,
  PLACEMENT_MIN_PER_SUBJECT,
  PLACEMENT_MIN_TOTAL,
  PLACEMENT_TARGET_TOTAL,
  type PlacementSubjectLike,
} from './select'

/** `n` adet, dersine göre okunabilir kimlik üretir. */
function pool(subjectId: string, n: number): string[] {
  return Array.from({ length: n }, (_, index) => `${subjectId}-q${index + 1}`)
}

function subjectsOf(spec: Record<string, number>): PlacementSubjectLike[] {
  return Object.entries(spec).map(([subjectId, examWeight]) => ({ subjectId, examWeight }))
}

function countsOf(selection: ReturnType<typeof buildPlacementSelection>): Record<string, number> {
  return Object.fromEntries(selection.bySubject.map((row) => [row.subjectId, row.count]))
}

describe('buildPlacementSelection', () => {
  it('ders yoksa boş ve "eksik" bir seçim döner', () => {
    const selection = buildPlacementSelection([], {}, PLACEMENT_TARGET_TOTAL)
    expect(selection).toEqual({ questionIds: [], bySubject: [], total: 0, short: true })
  })

  it('sorusu olmayan dersi tamamen düşürür', () => {
    const selection = buildPlacementSelection(subjectsOf({ mat: 0.6, tar: 0.4 }), {
      mat: pool('mat', 40),
      tar: [],
    })

    expect(selection.bySubject.map((row) => row.subjectId)).toEqual(['mat'])
    expect(selection.total).toBe(PLACEMENT_TARGET_TOTAL)
  })

  it('sorusu olan her dersten en az iki soru alır', () => {
    // 10 ders → taban 20; ağırlıkça ezilen ders bile 2'nin altına düşmez.
    const spec: Record<string, number> = {}
    const questions: Record<string, string[]> = {}
    for (let i = 0; i < 10; i += 1) {
      const id = `s${i}`
      spec[id] = i === 0 ? 0.99 : 0.001
      questions[id] = pool(id, 10)
    }

    const selection = buildPlacementSelection(subjectsOf(spec), questions)

    expect(selection.total).toBe(PLACEMENT_TARGET_TOTAL)
    for (const row of selection.bySubject) {
      expect(row.count).toBeGreaterThanOrEqual(PLACEMENT_MIN_PER_SUBJECT)
    }
    // Yumuşak üst sınır (3) hedefe ulaşmaya yettiği için aşılmaz: kalan 5 soru
    // en ağır dersten başlayarak 3'e çıkarılan derslere dağılır.
    expect(countsOf(selection).s0).toBe(3)
    expect(selection.bySubject.every((row) => row.count <= 3)).toBe(true)
  })

  it('havuzu bir soruluk olan dersten yalnızca o soruyu alır', () => {
    const selection = buildPlacementSelection(subjectsOf({ a: 0.5, b: 0.5 }), {
      a: pool('a', 1),
      b: pool('b', 40),
    })

    const counts = countsOf(selection)
    expect(counts.a).toBe(1)
    expect(counts.b).toBe(PLACEMENT_TARGET_TOTAL - 1)
    expect(selection.total).toBe(PLACEMENT_TARGET_TOTAL)
  })

  it('tek ders varsa yumuşak üst sınırı aşıp hedefe ulaşır', () => {
    const selection = buildPlacementSelection(subjectsOf({ mat: 1 }), { mat: pool('mat', 100) })

    expect(selection.total).toBe(PLACEMENT_TARGET_TOTAL)
    expect(selection.short).toBe(false)
    expect(new Set(selection.questionIds).size).toBe(PLACEMENT_TARGET_TOTAL)
  })

  it('havuz hedeften küçükse tüm havuzu verir ve "eksik" bayrağını kaldırır', () => {
    const selection = buildPlacementSelection(subjectsOf({ a: 1, b: 1 }), {
      a: pool('a', 4),
      b: pool('b', 3),
    })

    expect(selection.total).toBe(7)
    expect(selection.short).toBe(true)
    expect(countsOf(selection)).toEqual({ a: 4, b: 3 })
  })

  it('havuz 20-30 arasındaysa tamamı kullanılır', () => {
    const selection = buildPlacementSelection(subjectsOf({ a: 1, b: 1 }), {
      a: pool('a', 11),
      b: pool('b', 11),
    })

    // Hedef 25, kapasite 22 → kapasite kazanır.
    expect(selection.total).toBe(22)
    expect(selection.short).toBe(false)
  })

  it('çok dersli sınavda toplamı üst sınırın altında tutar', () => {
    // 20 ders × en az 2 = 40; 30'u aşamaz, dağıtım seyreltilir.
    const spec: Record<string, number> = {}
    const questions: Record<string, string[]> = {}
    for (let i = 0; i < 20; i += 1) {
      const id = `s${String(i).padStart(2, '0')}`
      spec[id] = i < 10 ? 0.9 : 0.1
      questions[id] = pool(id, 5)
    }

    const selection = buildPlacementSelection(subjectsOf(spec), questions)

    expect(selection.total).toBe(PLACEMENT_MAX_TOTAL)
    // Hiçbir ders tamamen dışlanmaz; ağır dersler 2, hafifler 1 soru alır.
    for (const row of selection.bySubject) expect(row.count).toBeGreaterThanOrEqual(1)
    const heavy = selection.bySubject.filter((row) => row.subjectId < 's10')
    expect(heavy.every((row) => row.count === 2)).toBe(true)
  })

  it('15 ders tam olarak 30 sorunun tabanını oluşturur', () => {
    const spec: Record<string, number> = {}
    const questions: Record<string, string[]> = {}
    for (let i = 0; i < 15; i += 1) {
      const id = `s${String(i).padStart(2, '0')}`
      spec[id] = 0.5
      questions[id] = pool(id, 5)
    }

    const selection = buildPlacementSelection(subjectsOf(spec), questions)
    expect(selection.total).toBe(PLACEMENT_MAX_TOTAL)
    expect(selection.bySubject.every((row) => row.count === 2)).toBe(true)
  })

  it('ağırlığa göre orantılı dağıtır', () => {
    const selection = buildPlacementSelection(
      subjectsOf({ mat: 0.5, fen: 0.3, sos: 0.2 }),
      { mat: pool('mat', 50), fen: pool('fen', 50), sos: pool('sos', 50) },
      20,
    )

    expect(selection.total).toBe(20)
    // Taban 2+2+2 = 6, kalan 14 → 7 / 4.2 / 2.8 ≈ 7 / 4 / 3.
    expect(countsOf(selection)).toEqual({ mat: 9, fen: 6, sos: 5 })
  })

  it('tüm ağırlıklar geçersizse dersleri eşit sayar', () => {
    const selection = buildPlacementSelection(
      subjectsOf({ a: 0, b: Number.NaN, c: -3 }),
      { a: pool('a', 50), b: pool('b', 50), c: pool('c', 50) },
      24,
    )

    expect(countsOf(selection)).toEqual({ a: 8, b: 8, c: 8 })
  })

  it('tek bir geçerli ağırlık varsa diğerleri yine tabanını korur', () => {
    const selection = buildPlacementSelection(
      subjectsOf({ a: 0, b: 1 }),
      { a: pool('a', 50), b: pool('b', 50) },
      20,
    )

    // Önce her ders yumuşak sınıra (3) çıkar, kalan 14 soru tek ağırlıklı derse gider.
    expect(countsOf(selection)).toEqual({ a: 3, b: 17 })
  })

  it('hedefi 20-30 aralığına kırpar', () => {
    const spec = subjectsOf({ a: 1, b: 1 })
    const questions = { a: pool('a', 50), b: pool('b', 50) }

    expect(buildPlacementSelection(spec, questions, 3).total).toBe(PLACEMENT_MIN_TOTAL)
    expect(buildPlacementSelection(spec, questions, 500).total).toBe(PLACEMENT_MAX_TOTAL)
    expect(buildPlacementSelection(spec, questions, Number.NaN).total).toBe(PLACEMENT_TARGET_TOTAL)
  })

  it('yinelenen soru kimliklerini ve yinelenen dersleri tekilleştirir', () => {
    const selection = buildPlacementSelection(
      [
        { subjectId: 'a', examWeight: 1 },
        { subjectId: 'a', examWeight: 1 },
        { subjectId: 'b', examWeight: 1 },
      ],
      { a: ['x', 'x', 'y', ''], b: pool('b', 30) },
    )

    expect(selection.bySubject.map((row) => row.subjectId)).toEqual(['a', 'b'])
    expect(countsOf(selection).a).toBe(2)
    expect(new Set(selection.questionIds).size).toBe(selection.questionIds.length)
  })

  it('aynı tohumla aynı, farklı tohumla farklı soruları seçer', () => {
    const spec = subjectsOf({ a: 0.5, b: 0.5 })
    const questions = { a: pool('a', 60), b: pool('b', 60) }

    const first = buildPlacementSelection(spec, questions, 25, { seed: 'tohum-1' })
    const again = buildPlacementSelection(spec, questions, 25, { seed: 'tohum-1' })
    const other = buildPlacementSelection(spec, questions, 25, { seed: 'tohum-2' })

    expect(first.questionIds).toEqual(again.questionIds)
    expect(first.questionIds).not.toEqual(other.questionIds)
    // Ders dağılımı tohumdan bağımsızdır; değişen yalnızca hangi sorular.
    expect(countsOf(first)).toEqual(countsOf(other))
  })

  it('sorular ders sırasına göre gruplanmış gelir', () => {
    const selection = buildPlacementSelection(subjectsOf({ mat: 0.5, tar: 0.5 }), {
      mat: pool('mat', 30),
      tar: pool('tar', 30),
    })

    const prefixes = selection.questionIds.map((id) => id.split('-')[0])
    const firstTar = prefixes.indexOf('tar')
    expect(prefixes.slice(0, firstTar).every((prefix) => prefix === 'mat')).toBe(true)
    expect(prefixes.slice(firstTar).every((prefix) => prefix === 'tar')).toBe(true)
  })

  it('seçilen her soru gerçekten kendi dersinin havuzundan gelir', () => {
    const selection = buildPlacementSelection(
      subjectsOf({ a: 0.7, b: 0.3 }),
      { a: pool('a', 40), b: pool('b', 40) },
      25,
      { seed: 'kontrol' },
    )

    const counts = countsOf(selection)
    const fromA = selection.questionIds.filter((id) => id.startsWith('a-'))
    expect(fromA).toHaveLength(counts.a ?? 0)
    expect(fromA.every((id) => pool('a', 40).includes(id))).toBe(true)
  })
})
