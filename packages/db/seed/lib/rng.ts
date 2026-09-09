/**
 * Tohumlu (deterministik) rastgelelik.
 *
 * Seed her çalıştığında AYNI demo verisini üretmeli: aksi hâlde ekran
 * görüntüleri, testler ve "panelde şu sayı görünmeli" beklentileri her
 * kurulumda değişir. `Math.random()` bu yüzden seed kodunda kullanılmaz.
 *
 * mulberry32 — küçük, hızlı, 32 bit durumlu bir üreteç. Kriptografik değildir
 * ve olmasına gerek yoktur.
 */
export function createRng(seed: number) {
  let state = seed >>> 0

  /** [0, 1) aralığında sayı. */
  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    /** [min, max] aralığında tam sayı (iki uç dâhil). */
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1))
    },
    /** Verilen olasılıkla true. */
    chance(probability: number): boolean {
      return next() < probability
    },
    /** Diziden bir öğe seçer. Dizi boşsa undefined. */
    pick<T>(items: readonly T[]): T | undefined {
      if (items.length === 0) return undefined
      return items[Math.floor(next() * items.length)]
    },
    /** Diziyi kopyalayıp karıştırır (Fisher-Yates). Girdiyi değiştirmez. */
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const a = copy[i]
        const b = copy[j]
        if (a !== undefined && b !== undefined) {
          copy[i] = b
          copy[j] = a
        }
      }
      return copy
    },
  }
}

export type Rng = ReturnType<typeof createRng>
