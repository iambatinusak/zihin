import { describe, expect, it } from 'vitest'

import { calculateMastery, rankPriorityTopics } from './mastery'
import type { AttemptLike, MasteryEntry, TopicLike } from './types'

/*
 * SARTNAME BOLUM 10 — YETKINLIK BUTCESI.
 *
 * "mastery hesabi < 200 ms" olculebilir tek performans hedefidir, cunku
 * `calculateMastery` saftir: ne aga, ne veritabanina, ne sistem saatine bakar.
 * Diger iki hedef (konu sayfasi LCP < 2.5 sn, cevap kaydi < 300 ms) calisan
 * bir arka uc ister ve burada olculemez.
 *
 * Belgelenmis en kotu durum: hesap yalnizca EN YENI 30 denemeyi kullanir
 * (`WINDOW_SIZE = 30`). Ancak fonksiyon listenin tamamini tarar (`repeatIndex`
 * verilmediginde tekrar sayimi icin), bu yuzden burada iki senaryo olculur:
 *   1. Tam pencere — 30 deneme, uygulamada tipik cagri.
 *   2. Bir konudaki TUM gecmis — 2000 deneme, uygulamanin sorguyu
 *      sinirlamayi unuttugu durumun bedeli.
 *
 * IKI ESIK: `BUDGET_MS` sartnamenin kendi butcesidir ve en yavas cagri icin
 * gecerlidir. `TRIPWIRE_MS` ise gercek gerileme alarmidir: olculen sure
 * mikrosaniye mertebesindedir, 20 ms hala yuzlerce kat pay birakir ama
 * algoritmanin karesel bir hale donmesini yakalar.
 */

const BUDGET_MS = 200
const TRIPWIRE_MS = 20

const BASE = new Date('2026-03-02T09:00:00+03:00')
const HOUR_MS = 60 * 60 * 1000

/**
 * Gercekci bir gecmis: her ucuncu deneme yanlis, zorluklar 1-5 arasinda doner,
 * sureler beklenenin altinda ve ustunde salinir ve sorularin ucte biri TEKRAR
 * cozulmustur (`repeatIndex` verilmez — fonksiyon kendisi hesaplasin, en pahali
 * yol budur).
 */
function makeHistory(count: number): AttemptLike[] {
  return Array.from({ length: count }, (_, index) => ({
    // Ucte bir tekrar: soru kimlikleri bilerek cakisir.
    questionId: `q${index % Math.max(1, Math.ceil(count / 1.5))}`,
    isCorrect: index % 3 !== 0,
    difficulty: (index % 5) + 1,
    timeSpentMs: 40_000 + (index % 7) * 12_000,
    expectedSeconds: index % 4 === 0 ? null : 60 + 20 * ((index % 5) + 1),
    answeredAt: new Date(BASE.getTime() + index * HOUR_MS),
  }))
}

/** Bir cagrinin suresi (ms). Sonuc kullanilir ki JIT cagriyi elemesin. */
function timeCalls(run: () => unknown, iterations: number): number[] {
  // Isinma: ilk cagrilar JIT derlemesini de olcer, butceyi temsil etmez.
  for (let i = 0; i < 20; i += 1) run()

  const durations: number[] = []
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now()
    const result = run()
    durations.push(performance.now() - start)
    expect(result).toBeDefined()
  }
  return durations.sort((a, b) => a - b)
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number)
}

describe('sartname §10 — yetkinlik hesabi butcesi', () => {
  it('30 denemelik tam pencere butcenin cok altinda kalir', () => {
    const attempts = makeHistory(30)
    // Girdi gercekten pencereyi dolduruyor mu: test kendini de dogrular.
    expect(calculateMastery(attempts).n).toBe(30)

    const durations = timeCalls(() => calculateMastery(attempts), 200)
    const slowest = durations[durations.length - 1] as number

    expect(slowest).toBeLessThan(BUDGET_MS)
    expect(median(durations)).toBeLessThan(TRIPWIRE_MS)
  })

  it('bir konudaki 2000 denemelik tum gecmis de butceye sigar', () => {
    const attempts = makeHistory(2000)
    // Pencere yine 30: fazlasi taranir ama hesaba girmez.
    expect(calculateMastery(attempts).n).toBe(30)

    const durations = timeCalls(() => calculateMastery(attempts), 50)
    const slowest = durations[durations.length - 1] as number

    expect(slowest).toBeLessThan(BUDGET_MS)
    expect(median(durations)).toBeLessThan(TRIPWIRE_MS)
  })

  it('1164 konuluk oncelik siralamasi da butceye sigar', () => {
    // Seed'deki gercek konu sayisi. Panel her yuklendiginde bu calisir.
    const topics: TopicLike[] = Array.from({ length: 1164 }, (_, index) => ({
      id: `t${index}`,
      subjectId: `s${index % 12}`,
      unitId: `u${index % 120}`,
      title: `Konu ${index}`,
      orderIndex: index,
      estimatedMinutes: 20 + (index % 5) * 10,
      difficulty: (index % 5) + 1,
      examWeight: ((index % 10) + 1) / 10,
    }))
    // Konularin yarisi olculmus, yarisi hic cozulmemis olsun.
    const masteries: MasteryEntry[] = topics
      .filter((_, index) => index % 2 === 0)
      .map((topic, index) => ({
        topicId: topic.id,
        mastery: (index * 7) % 101,
        status: 'medium',
        attemptsCount: 3 + (index % 20),
      }))

    expect(rankPriorityTopics(masteries, topics)).toHaveLength(topics.length)

    const durations = timeCalls(() => rankPriorityTopics(masteries, topics), 50)
    const slowest = durations[durations.length - 1] as number

    expect(slowest).toBeLessThan(BUDGET_MS)
    expect(median(durations)).toBeLessThan(TRIPWIRE_MS)
  })
})
