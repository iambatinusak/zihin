/**
 * Canlı deneme penceresinin durum makinesi (spec §M10).
 *
 * Burada ne Supabase, ne React, ne de `Date.now()` vardır: "şimdi" her zaman
 * parametre olarak gelir. Sebebi pratik — arka uç Docker'sız koşmadığı için
 * pencerenin doğruluğu yalnızca birim testleriyle güvence altına alınabiliyor
 * (bkz. `window.test.ts`).
 *
 * DÖRT DURUM VAR ve üçü bile yetmez:
 *   none   — pencere tanımlı değil; deneme her zaman çözülebilir, sıralama açık.
 *   before — pencere henüz açılmadı; deneme BAŞLATILAMAZ, geri sayım başlangıca.
 *   open   — pencere açık; deneme başlatılabilir ama sıralama HENÜZ açılmaz
 *            (herkes bitirmeden yüzdelik dilim yanıltıcı olurdu).
 *   closed — pencere kapandı; deneme artık başlatılamaz, sıralama açılır.
 */

/** Bir denemenin pencere alanları (`tests.live_window_start/end`). */
export type MockWindowLike = {
  live_window_start: string | null
  live_window_end: string | null
}

export type MockWindowState = 'none' | 'before' | 'open' | 'closed'

/** Okunamayan zaman damgası. `Date.parse` NaN döndüğünde bu kullanılır. */
function parse(value: string | null): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Pencerenin o andaki durumu.
 *
 * Bozuk ya da eksik damgalar YOK SAYILIR: yalnızca `start` okunabiliyorsa
 * "başlangıçtan sonra açık", yalnızca `end` okunabiliyorsa "bitişe kadar açık".
 * İkisi de yoksa `none`. Bozuk bir damga yüzünden öğrencinin denemeye
 * girememesi, kabul edilebilir bir davranış değil.
 *
 * SINIRLAR: `now === start` anı AÇIKTIR (pencere başladı), `now === end` anı
 * KAPALIDIR (pencere bitti). Şema `end > start` kısıtını zaten uyguluyor.
 */
export function mockWindowState(mock: MockWindowLike, now: Date): MockWindowState {
  const start = parse(mock.live_window_start)
  const end = parse(mock.live_window_end)
  if (start === null && end === null) return 'none'

  const current = now.getTime()
  if (start !== null && current < start) return 'before'
  if (end !== null && current >= end) return 'closed'
  return 'open'
}

/**
 * Deneme şu anda başlatılabilir mi?
 *
 * SUNUCUDA da bu yüklem çalıştırılır (`startMock`): pencereyi yalnızca arayüzde
 * denetlemek, Server Action'ın herkese açık bir uç nokta olduğu gerçeğini
 * görmezden gelmek olurdu.
 */
export function isMockStartable(state: MockWindowState): boolean {
  return state === 'none' || state === 'open'
}

/**
 * Sıralama (yüzdelik dilim) gösterilebilir mi?
 *
 * Canlı pencere sürerken GÖSTERİLMEZ: katılımcıların bir kısmı henüz
 * çözmemişken hesaplanan dilim, kapanışta değişir ve öğrenciye yanlış bir
 * bilgi vermiş oluruz. Penceresiz denemelerde böyle bir bekleme yok.
 */
export function isRankingVisible(state: MockWindowState): boolean {
  return state === 'none' || state === 'closed'
}

/**
 * Geri sayımın hedefi: pencere açılmadıysa başlangıç, açıksa bitiş.
 * `none` ve `closed` durumlarında sayılacak bir şey yoktur.
 */
export function countdownTarget(mock: MockWindowLike, state: MockWindowState): string | null {
  if (state === 'before') return mock.live_window_start
  if (state === 'open') return mock.live_window_end
  return null
}
