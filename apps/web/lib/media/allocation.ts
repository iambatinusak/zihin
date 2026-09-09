/**
 * Deneme kurucusunun soru dağıtımı (spec §M15).
 *
 * NEDEN SAF BİR MODÜL: havuz kısalığı bu projede İSTİSNA DEĞİL, NORMAL DURUM.
 * 1164 konudan yalnızca üçünde soru var; "Matematik'ten 40 soru" istendiğinde
 * havuzda 6 soru bulunması beklenen hâldir. Bu yüzden kısalık bir hata değil,
 * hesaplanan ve arayüzde uyarı olarak gösterilen bir sonuçtur. Hesabın
 * tamamı burada ve testlidir; arayüz yalnızca sonucu basar.
 */

export type SectionRequest = {
  subjectId: string
  /**
   * Ders ADI. `test_questions.section` kolonuna bu yazılır; `lib/mock/sections.ts`
   * gruplamayı bu metne göre yapar, bu yüzden kimlik değil ad taşınır.
   */
  subjectName: string
  requested: number
}

export type SectionAllocation = {
  subjectId: string
  subjectName: string
  requested: number
  /** Havuzdaki yayımlanmış soru sayısı. */
  available: number
  /** Denemeye gerçekten girecek soru sayısı. */
  taken: number
  /** İstenen ile alınan arasındaki fark; 0 ise sorun yok. */
  shortfall: number
}

export type MockAllocation = {
  sections: SectionAllocation[]
  totalRequested: number
  totalTaken: number
  /** En az bir bölüm istenenden az soru aldı. */
  hasShortfall: boolean
  /** Hiçbir bölüm tek soru bile bulamadı; deneme kurulamaz. */
  isEmpty: boolean
}

/**
 * İstekleri havuz büyüklüğüne göre kırpar.
 *
 * Kırpma bölüm bazındadır: bir dersin fazlası başka bir derse aktarılmaz.
 * Deneme sınavının anlamı ders dağılımıdır; Matematik'in eksiğini Türkçe ile
 * doldurmak denemeyi başka bir sınava çevirirdi.
 *
 * `requested <= 0` olan bölümler tamamen düşer — editör o dersi istemedi.
 */
export function allocateMockSections(
  requests: readonly SectionRequest[],
  availability: Readonly<Record<string, number>>,
): MockAllocation {
  const sections: SectionAllocation[] = []

  for (const request of requests) {
    const requested = Math.max(0, Math.floor(request.requested))
    if (requested === 0) continue

    const available = Math.max(0, Math.floor(availability[request.subjectId] ?? 0))
    const taken = Math.min(requested, available)

    sections.push({
      subjectId: request.subjectId,
      subjectName: request.subjectName,
      requested,
      available,
      taken,
      shortfall: requested - taken,
    })
  }

  const totalRequested = sections.reduce((sum, section) => sum + section.requested, 0)
  const totalTaken = sections.reduce((sum, section) => sum + section.taken, 0)

  return {
    sections,
    totalRequested,
    totalTaken,
    hasShortfall: sections.some((section) => section.shortfall > 0),
    isEmpty: totalTaken === 0,
  }
}

/**
 * Havuzdan `count` soru seçer.
 *
 * Rastgelelik dışarıdan verilir (`random`), böylece fonksiyon saf kalır ve
 * testte belirlenimci olur. Fisher-Yates: `pool` kopyalanır, çağıranın dizisi
 * değişmez.
 *
 * KRİTİK: seçim TESTİN OLUŞTURULMA ANINDA yapılır ve `test_questions` satırı
 * olarak yazılır. "Bu konudan rastgele N soru" kuralı çözüm anında
 * çalıştırılsaydı iki öğrenci farklı sorular görür, netleri kıyaslanamaz
 * olurdu.
 */
export function pickRandom<T>(
  pool: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const items = [...pool]
  const target = Math.min(Math.max(0, Math.floor(count)), items.length)

  for (let index = 0; index < target; index += 1) {
    const swapWith = index + Math.floor(random() * (items.length - index))
    const a = items[index]
    const b = items[swapWith]
    // noUncheckedIndexedAccess: iki uç da dizinin içinde ama tip yine de kontrol ister.
    if (a === undefined || b === undefined) continue
    items[index] = b
    items[swapWith] = a
  }

  return items.slice(0, target)
}
