import 'server-only'

import { evaluateBadges } from '@zihin/core'
import type { BadgeCode, BadgeContext } from '@zihin/core'
import type { DataClient } from '@/lib/data/client'
import { deliverNotificationsQuietly } from '@/lib/notifications/deliver'

/**
 * Rozet değerlendirme ve verme (spec §M13).
 *
 * ── SÖZLEŞME ───────────────────────────────────────────────────────────────
 * Bağlamı değiştirebilecek her akış (test bitti, video tamamlandı, kart tekrar
 * edildi, program bloğu işaretlendi) işini bitirdikten SONRA şunu çağırır:
 *
 *   await evaluateAndAwardBadgesQuietly(createSupabaseAdminClient(), user.id)
 *
 * Sessiz sarmalayıcı asla fırlatmaz: bir rozet yazımı öğrencinin cevabını,
 * bitmiş testini ya da tamamlanmış videosunu kaybettirmemeli.
 *
 * ── NEDEN SERVICE-ROLE ─────────────────────────────────────────────────────
 * `user_badges` ve `notifications` kullanıcı tarafından yazılamaz; rozet
 * uydurulamasın diye kararı sunucu verir (CONVENTIONS §4). `userId` her zaman
 * doğrulanmış oturumdan gelir, istek gövdesinden değil.
 *
 * ── FİKİRSİZLİK (idempotency) ──────────────────────────────────────────────
 * `user_badges` birincil anahtarı `(user_id, badge_id)`. Aynı rozeti ikinci
 * kez vermek 23505 üretir ve YUTULUR; oku-sonra-yaz yarışına girilmez. Bildirim
 * yalnızca ekleme gerçekten yeni satır yazdıysa gönderilir, yani öğrenci aynı
 * rozet için ikinci bir bildirim almaz.
 */

/** Bağlamı toplarken taranacak en fazla oturum sayısı. */
const SESSION_SCAN_LIMIT = 500

/** `classifyMastery` eşiği: 50'nin altı zayıf (CONVENTIONS §8). */
const WEAK_THRESHOLD = 50

export type AwardOptions = {
  /**
   * Bu istekte gerçekleşen zayıf→güçlü geçiş sayısı.
   * `recalculateTopicMastery` / `recalculateForAttempts` sonucundaki
   * `becameStrong` alanından gelir.
   */
  weakToStrongNow?: number
  now?: Date
}

export type AwardedBadge = {
  code: BadgeCode
  badgeId: string
  name: string
}

/**
 * Kullanıcının bağlamını toplar, core'un `evaluateBadges` kuralını çalıştırır
 * ve YENİ kazanılan rozetleri yazar. Kazanılan rozetleri döner.
 */
export async function evaluateAndAwardBadges(
  admin: DataClient,
  userId: string,
  options: AwardOptions = {},
): Promise<AwardedBadge[]> {
  const catalog = await loadBadgeCatalog(admin)
  if (catalog.size === 0) return []

  const context = await collectBadgeContext(admin, userId, catalog, options)
  const newCodes = evaluateBadges(context)
  if (newCodes.length === 0) return []

  const awarded: AwardedBadge[] = []
  const earnedAt = (options.now ?? new Date()).toISOString()

  for (const code of newCodes) {
    const badge = catalog.get(code)
    if (!badge) continue

    const { error } = await admin
      .from('user_badges')
      .insert({ user_id: userId, badge_id: badge.id, earned_at: earnedAt })

    if (error) {
      // 23505 = birincil anahtar ihlali: rozet zaten verilmiş. Beklenen sonuç;
      // yarışı okuma ile önlemeye çalışmak yerine anahtara güvenilir.
      if ((error as { code?: string }).code === '23505') continue
      console.error('[badges] user_badges yazılamadı:', error)
      continue
    }

    awarded.push({ code, badgeId: badge.id, name: badge.name })
    await notifyBadgeEarned(admin, userId, badge)
  }

  return awarded
}

/** Fırlatmayan sarmalayıcı — çağıranın asıl işlemi hiçbir koşulda geri alınmaz. */
export async function evaluateAndAwardBadgesQuietly(
  admin: DataClient,
  userId: string,
  options: AwardOptions = {},
): Promise<AwardedBadge[]> {
  try {
    return await evaluateAndAwardBadges(admin, userId, options)
  } catch (error) {
    console.error('[badges] rozet değerlendirmesi başarısız:', error)
    return []
  }
}

/* ------------------------------------------------------------------------- *
 * Bağlam toplama
 * ------------------------------------------------------------------------- */

type BadgeRow = { id: string; code: BadgeCode; name: string }

/** Rozet kataloğu: kod → satır. Silinmiş rozetler değerlendirmeye girmez. */
async function loadBadgeCatalog(admin: DataClient): Promise<Map<BadgeCode, BadgeRow>> {
  const { data, error } = await admin.from('badges').select('id, code, name').is('deleted_at', null)

  if (error) throw new Error(`badges okunamadı: ${error.message}`)

  const map = new Map<BadgeCode, BadgeRow>()
  for (const row of data ?? []) {
    map.set(row.code as BadgeCode, { id: row.id, code: row.code as BadgeCode, name: row.name })
  }
  return map
}

async function collectBadgeContext(
  admin: DataClient,
  userId: string,
  catalog: Map<BadgeCode, BadgeRow>,
  options: AwardOptions,
): Promise<BadgeContext> {
  const [videosCompleted, sessionCounts, cardsReviewed, streak, earnedBadges, weakToStrongStored] =
    await Promise.all([
      countCompletedVideos(admin, userId),
      countFinishedSessions(admin, userId),
      countCardsReviewed(admin, userId),
      readCurrentStreak(admin, userId),
      readEarnedBadgeCodes(admin, userId, catalog),
      countWeakToStrong(admin, userId),
    ])

  const live = Math.max(0, Math.floor(options.weakToStrongNow ?? 0))

  return {
    videosCompleted,
    testsCompleted: sessionCounts.tests,
    mocksCompleted: sessionCounts.mocks,
    cardsReviewed,
    currentStreak: streak,
    weakToStrongCount: Math.max(weakToStrongStored, live),
    earnedBadges,
  }
}

async function countCompletedVideos(admin: DataClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .from('video_progress')
    .select('video_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('completed_at', 'is', null)

  if (error) throw new Error(`video_progress okunamadı: ${error.message}`)
  return count ?? 0
}

/**
 * Bitmiş oturumlar konu testi / deneme diye ayrılır.
 *
 * İki düz sorgu: oturumlar, sonra o oturumların testlerinin türü. Üretilen
 * tipler ilişki taşımadığı için gömülü join kullanılmıyor (CONVENTIONS §5).
 * Seviye tespit oturumları (`is_placement`) sayılmaz — kendi ödülü var, "on
 * test bitir" rozetine girmemeli.
 */
async function countFinishedSessions(
  admin: DataClient,
  userId: string,
): Promise<{ tests: number; mocks: number }> {
  const { data, error } = await admin
    .from('test_sessions')
    .select('id, test_id')
    .eq('user_id', userId)
    .eq('is_placement', false)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(SESSION_SCAN_LIMIT)

  if (error) throw new Error(`test_sessions okunamadı: ${error.message}`)

  const sessions = data ?? []
  if (sessions.length === 0) return { tests: 0, mocks: 0 }

  const testIds = [...new Set(sessions.map((row) => row.test_id))]
  const { data: testRows, error: testError } = await admin
    .from('tests')
    .select('id, type')
    .in('id', testIds)

  if (testError) throw new Error(`tests okunamadı: ${testError.message}`)

  const typeById = new Map((testRows ?? []).map((row) => [row.id, row.type]))

  let tests = 0
  let mocks = 0
  for (const session of sessions) {
    const type = typeById.get(session.test_id)
    if (type === undefined) continue
    if (type === 'mock_exam') mocks += 1
    else tests += 1
  }
  return { tests, mocks }
}

/**
 * Tekrar edilen kart sayısı `daily_activity`den toplanır.
 *
 * `card_reviews` satır başına yalnızca SON durumu tutuyor; kaç tekrar
 * yapıldığını o tablo bilmiyor. Günlük sayaç ise yalnızca VADESİ GELMİŞ
 * tekrarları sayıyor (bkz. kartlar/actions.ts) — yani aynı kartı döngüye alıp
 * rozet toplamak mümkün değil.
 */
async function countCardsReviewed(admin: DataClient, userId: string): Promise<number> {
  const { data, error } = await admin
    .from('daily_activity')
    .select('cards_reviewed')
    .eq('user_id', userId)

  if (error) throw new Error(`daily_activity okunamadı: ${error.message}`)
  return (data ?? []).reduce((total, row) => total + (row.cards_reviewed ?? 0), 0)
}

async function readCurrentStreak(admin: DataClient, userId: string): Promise<number> {
  const { data, error } = await admin
    .from('profiles')
    .select('current_streak')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`profiles okunamadı: ${error.message}`)
  return data?.current_streak ?? 0
}

async function readEarnedBadgeCodes(
  admin: DataClient,
  userId: string,
  catalog: Map<BadgeCode, BadgeRow>,
): Promise<BadgeCode[]> {
  const { data, error } = await admin.from('user_badges').select('badge_id').eq('user_id', userId)

  if (error) throw new Error(`user_badges okunamadı: ${error.message}`)

  const codeById = new Map([...catalog.values()].map((badge) => [badge.id, badge.code]))
  const codes: BadgeCode[] = []
  for (const row of data ?? []) {
    const code = codeById.get(row.badge_id)
    if (code !== undefined) codes.push(code)
  }
  return codes
}

/**
 * ZAYIFTAN GÜÇLÜYE sayısı — SEÇİM VE BEDELİ.
 *
 * Şemada böyle bir sayaç kolonu yok. İki seçenek vardı: (a) `profiles`'a bir
 * kolon eklemek, (b) mevcut verilerden türetmek. (b) seçildi: migration'lar
 * başka bir ajanın mülkiyetinde ve tek eşiği 1 olan bir rozet için kalıcı
 * sayaç, geri doldurulması gereken yeni bir durum yaratırdı.
 *
 * Türetme: bugün GÜÇLÜ olan konulardan, geçmişinde 50'nin altına düşmüş bir
 * fotoğrafı bulunanlar sayılır (`mastery_history` + `topic_mastery`).
 *
 * BEDELİ: `mastery_history` haftalık cron ile yazılıyor. Bir konu iki fotoğraf
 * arasında zayıftan güçlüye çıkarsa geçmişte izi kalmayabilir. Bu yüzden
 * çağıran taraf aynı istekte olan geçişi `weakToStrongNow` ile bildirir ve
 * rozet tam o anda verilir; türetme yalnızca geriye dönük ikinci bir yoldur.
 * Rozet bir kez verildiği için ikisinin çakışması bir şeyi bozmaz.
 */
async function countWeakToStrong(admin: DataClient, userId: string): Promise<number> {
  const { data: strongRows, error } = await admin
    .from('topic_mastery')
    .select('topic_id')
    .eq('user_id', userId)
    .eq('status', 'strong')

  if (error) throw new Error(`topic_mastery okunamadı: ${error.message}`)

  const strongIds = (strongRows ?? []).map((row) => row.topic_id)
  if (strongIds.length === 0) return 0

  const { data: historyRows, error: historyError } = await admin
    .from('mastery_history')
    .select('topic_id')
    .eq('user_id', userId)
    .in('topic_id', strongIds)
    .lt('mastery', WEAK_THRESHOLD)

  if (historyError) throw new Error(`mastery_history okunamadı: ${historyError.message}`)

  return new Set((historyRows ?? []).map((row) => row.topic_id)).size
}

/**
 * Rozet bildirimi.
 *
 * Başlık ve gövde rozet kaydından gelir: rozet metinleri seed içeriğidir,
 * sözlüğe girmez (CONVENTIONS §1).
 *
 * Yazma `deliverNotificationsQuietly` üzerinden yapılır: uygulama içi bildirim
 * tercihini kapatmış öğrenciye satır YAZILMAZ. Rozetin kendisi yine verilir —
 * kapatılan şey haberdar edilme biçimi, kazanılan şey değil.
 */
async function notifyBadgeEarned(
  admin: DataClient,
  userId: string,
  badge: BadgeRow,
): Promise<void> {
  await deliverNotificationsQuietly(admin, [
    {
      userId,
      type: 'badge_earned',
      title: 'Yeni rozet kazandın',
      body: badge.name,
      link: '/rozetler',
    },
  ])
}
