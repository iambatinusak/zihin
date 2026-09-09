/**
 * Seçili öğrencinin belirlenmesi — GİZLİLİK SINIRININ saf yarısı.
 *
 * `?ogrenci=` adres çubuğundan gelir, yani kullanıcı denetimindedir. Bu yüzden
 * kimlik ASLA doğrudan sorguya verilmez: önce velinin `parent_links` üzerinden
 * gelen bağlı öğrenci kümesiyle karşılaştırılır. Eşleşmeyen kimlik hata
 * üretmez, sessizce ilk bağlı öğrenciye düşer — veli, bağlantısı olmayan bir
 * öğrencinin var olup olmadığını bir hata ekranından da öğrenememeli.
 *
 * Saf ve bağımsız: listeyi sunucu veritabanından alır, kararı burası verir.
 */

export type SelectableStudent = { id: string }

export function resolveSelectedStudent<T extends SelectableStudent>(
  students: readonly T[],
  requestedId: string | null | undefined,
): T | null {
  const first = students[0]
  if (first === undefined) return null

  if (typeof requestedId !== 'string' || requestedId.trim() === '') return first

  const wanted = requestedId.trim()
  return students.find((student) => student.id === wanted) ?? first
}

/** Seçim adres çubuğunda taşınır; yenilemede bağlam kaybolmasın. */
export function studentHref(basePath: string, studentId: string, weekStart?: string): string {
  const params = new URLSearchParams({ ogrenci: studentId })
  if (weekStart) params.set('hafta', weekStart)
  return `${basePath}?${params.toString()}`
}
