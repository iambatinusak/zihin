/**
 * Haftalık liderlik tablosunun SAF şekillendirme kuralları (spec §M13).
 *
 * ── GİZLİLİK: İKİ KURAL, PAZARLIK KONUSU DEĞİL ─────────────────────────────
 *  1. YALNIZCA GÖRÜNEN AD. Tabloda `profiles.display_name` gösterilir;
 *     `full_name` asla. Görünen adı olmayan kullanıcı gerçek adına DÜŞMEZ,
 *     anonim etiketle listelenir — öğrencinin gerçek adı, kendi seçmediği bir
 *     ekranda başka öğrencilere gösterilemez.
 *  2. KATILMAYAN LİSTEDE YOKTUR. `leaderboard_opt_in = false` olan kullanıcı
 *     soluk/gizli değil, tamamen ELENİR: sıralamaya, sıra numaralarına ve
 *     satır sayısına hiç girmez.
 *
 * Şekillendirme burada saf tutuluyor çünkü kural veri katmanında gömülü
 * kalırsa test edilemez; sızıntı da tam olarak burada olur.
 */

export type LeaderboardCandidate = {
  userId: string
  /** `profiles.display_name`. Boş/null ise anonim etiket kullanılır. */
  displayName: string | null
  /** Bu hafta kazanılan XP (`daily_activity.xp_earned` toplamı). */
  xp: number
  /** `profiles.leaderboard_opt_in`. false ise satır tamamen elenir. */
  optIn: boolean
}

export type LeaderboardRow = {
  rank: number
  displayName: string
  xp: number
  isCurrentUser: boolean
}

/** Varsayılan liste boyu (spec §M13: ilk 50). */
export const LEADERBOARD_SIZE = 50

function safeXp(value: number): number {
  if (!Number.isFinite(value)) return 0
  const whole = Math.floor(value)
  return whole > 0 ? whole : 0
}

/**
 * Adayları sıralar, ilk `limit` satırı döner ve kullanıcının kendi satırını
 * listenin dışında kaldıysa SONA ekler.
 *
 * Sıralama: XP azalan; eşitlikte kullanıcı kimliği artan — çıktının her
 * çalıştırmada aynı olması için deterministik bir tie-break gerekiyor ve
 * ad kullanılamaz (anonim satırlar aynı etiketi taşır).
 *
 * Sıra numarası "yarışma sıralaması"dır: eşit XP eşit sıra alır, sonraki sıra
 * atlanır (1, 2, 2, 4). Aynı puanı almış iki öğrenciye farklı sıra vermek
 * uydurma bir üstünlük olurdu.
 */
export function buildLeaderboard(
  candidates: readonly LeaderboardCandidate[],
  currentUserId: string | null,
  anonymousLabel: string,
  limit: number = LEADERBOARD_SIZE,
): LeaderboardRow[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : LEADERBOARD_SIZE

  // KURAL 2: katılmayanlar burada, her şeyden önce elenir.
  const eligible = candidates
    .filter((entry) => entry.optIn)
    .map((entry) => ({ ...entry, xp: safeXp(entry.xp) }))
    .sort((a, b) => (b.xp !== a.xp ? b.xp - a.xp : a.userId < b.userId ? -1 : 1))

  const rows: LeaderboardRow[] = []
  let previousXp: number | null = null
  let previousRank = 0

  eligible.forEach((entry, index) => {
    const rank = previousXp !== null && entry.xp === previousXp ? previousRank : index + 1
    previousXp = entry.xp
    previousRank = rank

    rows.push({
      rank,
      // KURAL 1: yalnızca görünen ad; yoksa anonim etiket.
      displayName: normalizeName(entry.displayName, anonymousLabel),
      xp: entry.xp,
      isCurrentUser: currentUserId !== null && entry.userId === currentUserId,
    })
  })

  const top = rows.slice(0, safeLimit)
  if (currentUserId === null) return top

  // Kendi satırı listenin dışında kaldıysa sona eklenir: öğrenci kendi yerini
  // her zaman görebilmeli, yoksa tablo onun için anlamsız.
  if (top.some((row) => row.isCurrentUser)) return top
  const own = rows.find((row) => row.isCurrentUser)
  return own ? [...top, own] : top
}

function normalizeName(displayName: string | null, anonymousLabel: string): string {
  const trimmed = (displayName ?? '').trim()
  return trimmed === '' ? anonymousLabel : trimmed
}

/**
 * `daily_activity` satırlarını kullanıcı başına haftalık XP toplamına indirger.
 * Satırlar zaten hafta aralığıyla sorgulanmış olmalı; burada filtre yapılmaz.
 */
export function sumWeeklyXp(
  rows: readonly { user_id: string; xp_earned: number | null }[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const previous = totals.get(row.user_id) ?? 0
    totals.set(row.user_id, previous + safeXp(row.xp_earned ?? 0))
  }
  return totals
}
