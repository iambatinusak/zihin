import { describe, expect, it } from 'vitest'
import { computeReorder, neighborIndex, nextOrderIndex, type Orderable } from './reorder'

/** 0..n-1 sıralı, sağlıklı bir kardeş listesi. */
function siblings(count: number): Orderable[] {
  return Array.from({ length: count }, (_, index) => ({ id: `n${index}`, orderIndex: index }))
}

describe('computeReorder', () => {
  it('bir sıra yukarı taşımada yalnızca iki satır yazar', () => {
    expect(computeReorder(siblings(5), 'n3', 2)).toEqual([
      { id: 'n3', orderIndex: 2 },
      { id: 'n2', orderIndex: 3 },
    ])
  })

  it('bir sıra aşağı taşımada yalnızca iki satır yazar', () => {
    expect(computeReorder(siblings(5), 'n1', 2)).toEqual([
      { id: 'n2', orderIndex: 1 },
      { id: 'n1', orderIndex: 2 },
    ])
  })

  it('başa taşırken yalnızca aradaki pencereyi kaydırır', () => {
    expect(computeReorder(siblings(6), 'n2', 0)).toEqual([
      { id: 'n2', orderIndex: 0 },
      { id: 'n0', orderIndex: 1 },
      { id: 'n1', orderIndex: 2 },
    ])
  })

  it('sona taşırken pencerenin dışına dokunmaz', () => {
    expect(computeReorder(siblings(6), 'n3', 5)).toEqual([
      { id: 'n4', orderIndex: 3 },
      { id: 'n5', orderIndex: 4 },
      { id: 'n3', orderIndex: 5 },
    ])
  })

  it('aynı yere bırakmak hiçbir yazma üretmez', () => {
    expect(computeReorder(siblings(4), 'n2', 2)).toEqual([])
  })

  it('bilinmeyen kimlik için boş döner', () => {
    expect(computeReorder(siblings(4), 'yok', 1)).toEqual([])
  })

  it('aralık dışı hedef için boş döner', () => {
    expect(computeReorder(siblings(4), 'n0', 4)).toEqual([])
    expect(computeReorder(siblings(4), 'n0', -1)).toEqual([])
  })

  it('tek elemanlı ve boş listede hiçbir şey yapmaz', () => {
    expect(computeReorder(siblings(1), 'n0', 0)).toEqual([])
    expect(computeReorder([], 'n0', 0)).toEqual([])
  })

  it('boşluklu order_index değerlerini yalnızca pencere içinde onarır', () => {
    const gapped: Orderable[] = [
      { id: 'a', orderIndex: 0 },
      { id: 'b', orderIndex: 10 },
      { id: 'c', orderIndex: 20 },
      { id: 'd', orderIndex: 30 },
    ]
    // c'yi b'nin önüne al: pencere 1..2, d'ye (index 3) dokunulmaz.
    expect(computeReorder(gapped, 'c', 1)).toEqual([
      { id: 'c', orderIndex: 1 },
      { id: 'b', orderIndex: 2 },
    ])
  })

  it('taşıma sonrası liste gerçekten istenen sırada olur', () => {
    const items = siblings(5)
    const patches = computeReorder(items, 'n0', 4)
    const applied = new Map(patches.map((patch) => [patch.id, patch.orderIndex]))
    const result = items
      .map((item) => ({ id: item.id, orderIndex: applied.get(item.id) ?? item.orderIndex }))
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((item) => item.id)

    expect(result).toEqual(['n1', 'n2', 'n3', 'n4', 'n0'])
  })
})

describe('neighborIndex', () => {
  it('ortadaki öğe için komşu konumu verir', () => {
    expect(neighborIndex(siblings(3), 'n1', 'up')).toBe(0)
    expect(neighborIndex(siblings(3), 'n1', 'down')).toBe(2)
  })

  it('uçlarda null döner', () => {
    expect(neighborIndex(siblings(3), 'n0', 'up')).toBeNull()
    expect(neighborIndex(siblings(3), 'n2', 'down')).toBeNull()
  })

  it('bilinmeyen kimlik için null döner', () => {
    expect(neighborIndex(siblings(3), 'yok', 'up')).toBeNull()
  })
})

describe('nextOrderIndex', () => {
  it('boş listede 0 verir', () => {
    expect(nextOrderIndex([])).toBe(0)
  })

  it('en büyük değerin bir fazlasını verir', () => {
    expect(
      nextOrderIndex([
        { id: 'a', orderIndex: 4 },
        { id: 'b', orderIndex: 9 },
      ]),
    ).toBe(10)
  })
})
