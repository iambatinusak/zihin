/**
 * Kardeş düğümlerin sıra hesabı (müfredat ağacı).
 *
 * Saf: girdi aynıysa çıktı aynı. Supabase, React ya da tarih bilmez —
 * bu yüzden testi Docker'sız koşar (CONVENTIONS §5).
 *
 * NEDEN "yalnızca etkilenenler": bir konuyu bir sıra yukarı almak, ünitedeki
 * 40 konunun tamamını yeniden yazmayı gerektirmez. Yalnızca taşınan öğe ile
 * onun eski/yeni konumu arasındaki pencere kayar; dışarıda kalan kardeşlerin
 * `order_index` değeri zaten doğrudur. Tek `upsert` ile gönderilir, N ayrı
 * istek atılmaz.
 */

/** Sıralanabilir kardeş. Ağaçtaki dört düzey de (sınav/ders/ünite/konu) bu şekle uyar. */
export type Orderable = {
  id: string
  orderIndex: number
}

/** Veritabanına yazılacak tek satırlık düzeltme. */
export type OrderPatch = {
  id: string
  orderIndex: number
}

export type MoveDirection = 'up' | 'down'

/**
 * `items` verilen sırayla (ekranda göründüğü gibi) beklenir.
 * Kimliği bulunamayan öğe ya da aralık dışı hedef için boş liste döner —
 * çağıran taraf "yazacak bir şey yok" der, hata fırlatmaz.
 */
export function computeReorder(
  items: readonly Orderable[],
  id: string,
  toIndex: number,
): OrderPatch[] {
  const fromIndex = items.findIndex((item) => item.id === id)
  if (fromIndex === -1) return []
  if (toIndex < 0 || toIndex >= items.length) return []
  if (fromIndex === toIndex) return []

  const moved = items.slice()
  const [item] = moved.splice(fromIndex, 1)
  if (item === undefined) return []
  moved.splice(toIndex, 0, item)

  // Pencere dışındaki kardeşler yerinde kaldı; onları yazmak gereksiz yazma
  // ve gereksiz `updated_at` demektir.
  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)

  const patches: OrderPatch[] = []
  for (let position = start; position <= end; position += 1) {
    const candidate = moved[position]
    if (candidate === undefined) continue
    if (candidate.orderIndex !== position) {
      patches.push({ id: candidate.id, orderIndex: position })
    }
  }

  return patches
}

/**
 * "Yukarı taşı" / "Aşağı taşı" menüsünün hedef konumu.
 * Listenin ucundaysa `null` — düğme devre dışı bırakılır, sessizce hiçbir şey
 * yapan bir eylem gösterilmez.
 */
export function neighborIndex(
  items: readonly Orderable[],
  id: string,
  direction: MoveDirection,
): number | null {
  const fromIndex = items.findIndex((item) => item.id === id)
  if (fromIndex === -1) return null

  const target = direction === 'up' ? fromIndex - 1 : fromIndex + 1
  if (target < 0 || target >= items.length) return null
  return target
}

/**
 * Yeni bir kardeş eklenirken kullanılacak `order_index`: listenin sonu.
 * Boş listede 0 döner.
 */
export function nextOrderIndex(items: readonly Orderable[]): number {
  let max = -1
  for (const item of items) {
    if (item.orderIndex > max) max = item.orderIndex
  }
  return max + 1
}
