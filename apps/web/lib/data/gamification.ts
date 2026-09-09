import 'server-only'

import { AppError } from '@/lib/errors'
import {
  buildLeaderboard,
  sumWeeklyXp,
  LEADERBOARD_SIZE,
  type LeaderboardCandidate,
  type LeaderboardRow,
} from '@/lib/gamification/leaderboard'
import { turkeyWeekWindow } from '@/lib/time/turkey'
import type { DataClient } from './client'

/**
 * Oyunlaştırma okuma katmanı (spec §M13, ekran §9.14).
 *
 * Rozet listesi ve seri özeti kullanıcının KENDİ satırlarıdır; normal oturum
 * istemcisiyle okunur. Liderlik tablosu ise başka öğrencilerin satırlarını
 * gerektirir ve RLS bunu kapatır — o fonksiyon service-role istemcisi ister,
 * bkz. `getWeeklyLeaderboard`.
 */

type Client = DataClient

export type BadgeBoardItem = {
  code: string
  name: string
  description: string | null
  /** lucide-react bileşen adı; dosya yolu değil. */
  icon: string | null
  /** `badges.rule` jsonb'si: { metric, threshold }. Eşik koda gömülmez. */
  rule: { metric: string | null; threshold: number | null }
  earned: boolean
  /** Kazanıldıysa ISO damga, aksi hâlde null. */
  earnedAt: string | null
}

/**
 * Tüm rozetler + kullanıcının kazandıkları, `order_index` sırasıyla.
 * Kazanılmayanlar listeden DÜŞMEZ: kilitli rozet, kuralıyla birlikte hedefi
 * gösterir; gizlense ekran "yapacak bir şey yok" derdi.
 */
export async function getBadgeBoard(client: Client, userId: string): Promise<BadgeBoardItem[]> {
  const { data: badgeRows, error } = await client
    .from('badges')
    .select('id, code, name, description, icon, rule, order_index')
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Rozetler yüklenemedi.')

  const badges = badgeRows ?? []
  if (badges.length === 0) return []

  const { data: earnedRows, error: earnedError } = await client
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', userId)

  if (earnedError) throw new AppError('internal', 'Rozetler yüklenemedi.')

  const earnedAtById = new Map((earnedRows ?? []).map((row) => [row.badge_id, row.earned_at]))

  return badges.map((badge) => {
    const earnedAt = earnedAtById.get(badge.id) ?? null
    return {
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      rule: readRule(badge.rule),
      earned: earnedAt !== null,
      earnedAt,
    }
  })
}

/** `badges.rule` serbest bir jsonb; şema onu doğrulamıyor, savunmacı okunur. */
function readRule(value: unknown): { metric: string | null; threshold: number | null } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { metric: null, threshold: null }
  }
  const record = value as Record<string, unknown>
  const metric = typeof record.metric === 'string' ? record.metric : null
  const threshold =
    typeof record.threshold === 'number' && Number.isFinite(record.threshold)
      ? Math.floor(record.threshold)
      : null
  return { metric, threshold }
}

export type StreakSummary = {
  currentStreak: number
  longestStreak: number
  lastStudyDate: string | null
}

/** Güncel ve en uzun seri. `profiles` kullanıcının kendi satırıdır. */
export async function getStreakSummary(client: Client, userId: string): Promise<StreakSummary> {
  const { data, error } = await client
    .from('profiles')
    .select('current_streak, longest_streak, last_study_date')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Seri bilgisi yüklenemedi.')

  return {
    currentStreak: data?.current_streak ?? 0,
    longestStreak: data?.longest_streak ?? 0,
    lastStudyDate: data?.last_study_date ?? null,
  }
}

export type WeeklyLeaderboard = {
  /** Haftanın pazartesisi (YYYY-MM-DD, Türkiye saati). */
  weekStart: string
  rows: LeaderboardRow[]
}

/** Bir taramada okunacak en fazla günlük aktivite satırı. */
const ACTIVITY_SCAN_LIMIT = 5000

/**
 * Aynı sınava hazırlanan öğrencilerin BU HAFTA kazandığı XP'ye göre sıralaması.
 *
 * ── NEDEN SERVICE-ROLE İSTEMCİSİ ───────────────────────────────────────────
 * Bir öğrenci başka öğrencilerin `profiles` ve `daily_activity` satırlarını
 * RLS ile okuyamaz. Tablo bu yüzden sunucuda, service-role istemcisiyle
 * kurulur ve DIŞARI YALNIZCA `{ rank, displayName, xp, isCurrentUser }` çıkar:
 * kullanıcı kimliği, e-posta, gerçek ad ya da sınıf bilgisi bu fonksiyonun
 * dönüş tipinde yoktur ve olmamalıdır.
 *
 * ── NEDEN `profiles.xp` DEĞİL ──────────────────────────────────────────────
 * `profiles.xp` ömür boyu toplamdır; tabloyu donduran, yeni gelenin asla
 * göremeyeceği bir sıralama üretirdi. Haftalık ölçü `daily_activity.xp_earned`
 * toplamıdır ve pazartesi 00:00 TR'de kendiliğinden sıfırlanır.
 *
 * Gizlilik kuralları (yalnızca görünen ad · katılmayan tamamen elenir)
 * `lib/gamification/leaderboard.ts` içinde uygulanır ve orada test edilir.
 */
export async function getWeeklyLeaderboard(
  adminClient: Client,
  params: {
    /** Sıralamanın kapsamı: aynı sınav. */
    examId: string
    /** Kendi satırı işaretlenecek kullanıcı. */
    currentUserId: string
    /** Görünen adı olmayan öğrenciler için etiket (i18n'den gelir). */
    anonymousLabel: string
    now?: Date
    limit?: number
  },
): Promise<WeeklyLeaderboard> {
  const week = turkeyWeekWindow(params.now ?? new Date())
  if (week.weekStart === '') return { weekStart: '', rows: [] }

  const { data: activityRows, error } = await adminClient
    .from('daily_activity')
    .select('user_id, xp_earned')
    .gte('date', week.weekStart)
    .lte('date', week.weekEnd)
    .limit(ACTIVITY_SCAN_LIMIT)

  if (error) throw new AppError('internal', 'Liderlik tablosu yüklenemedi.')

  const totals = sumWeeklyXp(activityRows ?? [])

  // Kendi satırı, bu hafta hiç XP kazanmamış olsa bile listede yerini görsün.
  if (!totals.has(params.currentUserId)) totals.set(params.currentUserId, 0)

  const userIds = [...totals.keys()]
  if (userIds.length === 0) return { weekStart: week.weekStart, rows: [] }

  const { data: profileRows, error: profileError } = await adminClient
    .from('profiles')
    .select('id, display_name, leaderboard_opt_in, exam_id, role')
    .in('id', userIds)
    .eq('exam_id', params.examId)
    .eq('role', 'student')

  if (profileError) throw new AppError('internal', 'Liderlik tablosu yüklenemedi.')

  const candidates: LeaderboardCandidate[] = (profileRows ?? []).map((profile) => ({
    userId: profile.id,
    displayName: profile.display_name,
    // Kolon varsayılanı true; null gelen bir satır katılıyor sayılmaz —
    // belirsizlikte gizliliği koruyan taraf seçilir.
    optIn: profile.leaderboard_opt_in === true,
    xp: totals.get(profile.id) ?? 0,
  }))

  return {
    weekStart: week.weekStart,
    rows: buildLeaderboard(
      candidates,
      params.currentUserId,
      params.anonymousLabel,
      params.limit ?? LEADERBOARD_SIZE,
    ),
  }
}
