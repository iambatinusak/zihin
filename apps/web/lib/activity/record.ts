import 'server-only'

import { updateStreak } from '@zihin/core'
import type { StreakState } from '@zihin/core'
import type { DataClient } from '@/lib/data/client'
import { turkeyDayKey } from './day'
import {
  applyDelta,
  EMPTY_TOTALS,
  isEmptyDelta,
  meetsStreakThreshold,
  sanitizeDelta,
  type ActivityTotals,
  type StudyActivityDelta,
} from './delta'

/**
 * Çalışma aktivitesinin TEK yazma noktası (spec §M13).
 *
 * ── DİĞER AJANLAR İÇİN SÖZLEŞME ────────────────────────────────────────────
 * Bir öğrenci çalışma sayılan bir şey yaptığında (test bitti, kart tekrar
 * edildi, video tamamlandı, program bloğu işaretlendi) bu fonksiyon çağrılır:
 *
 *   import { createSupabaseAdminClient } from '@/lib/supabase/admin'
 *   import { recordStudyActivityQuietly } from '@/lib/activity/record'
 *   await recordStudyActivityQuietly(createSupabaseAdminClient(), user.id, {
 *     seconds: 420, questions: 12,
 *   })
 *
 * Alanlar ARTIŞTIR, mutlak değer değil. Hepsi opsiyoneldir; yalnızca sizi
 * ilgilendireni gönderin. `recordStudyActivityQuietly` asla fırlatmaz — bir
 * istatistik yazımı öğrencinin asıl işlemini (cevabın kaydı, testin bitişi)
 * geri almamalı.
 *
 * ── NEDEN SERVICE-ROLE ─────────────────────────────────────────────────────
 * `daily_activity` kullanıcının kendi satırıdır ama `profiles.current_streak`,
 * `longest_streak` ve `last_study_date` RLS tetikleyicisiyle kullanıcı
 * güncellemesine kapalıdır (0011_rls_policies.sql) — seri uydurulamasın diye.
 * Bu yüzden yazma yolu service-role istemcisi ister (CONVENTIONS §4).
 *
 * ── EŞİK SUNUCUDA ÖLÇÜLÜR ──────────────────────────────────────────────────
 * Seri, o GÜNÜN veritabanındaki toplam süresi 15 dakikayı geçtiğinde ilerler.
 * Çağıran taraf "seriyi artır" diyemez; yalnızca ne yaptığını bildirir.
 */

export type RecordActivityResult = {
  /** Yazılan gün (Türkiye saati, YYYY-MM-DD). */
  date: string
  /** Yazımdan SONRAKİ günlük toplamlar. */
  totals: ActivityTotals
  /** Seri durumu; eşiğe ulaşılmadıysa profil değişmemiş demektir. */
  streak: StreakState | null
}

/**
 * Günlük aktiviteyi ve seriyi günceller.
 *
 * `daily_activity` (kullanıcı, gün) çiftinde TEK satırdır: okunur, artış
 * eklenir, `upsert` ile geri yazılır. Yarış durumu bilinçli olarak kabul
 * edilmiştir — iki eşzamanlı yazımda biri diğerinin artışını ezebilir. Bunun
 * doğru çözümü `update ... set x = x + n` yapan bir Postgres fonksiyonudur;
 * `supabase-js` bunu ifade edemiyor ve migration'lar başka bir ajanın
 * mülkiyetinde. Kaybedilen şey bir istatistik sayacı, kullanıcının verisi
 * değil. BİLİNEN SINIR: çözümü `update ... set x = x + n` yapan bir
 * `public.record_daily_activity()` fonksiyonudur; MVP kapsamına alınmadı.
 */
export async function recordStudyActivity(
  adminClient: DataClient,
  userId: string,
  delta: StudyActivityDelta,
  now: Date = new Date(),
): Promise<RecordActivityResult> {
  const safe = sanitizeDelta(delta)
  const date = turkeyDayKey(now)

  if (date === '' || isEmptyDelta(safe)) {
    return { date, totals: EMPTY_TOTALS, streak: null }
  }

  const current = await readTotals(adminClient, userId, date)
  const totals = applyDelta(current, safe)

  const { error } = await adminClient.from('daily_activity').upsert(
    {
      user_id: userId,
      date,
      study_seconds: totals.studySeconds,
      questions_answered: totals.questionsAnswered,
      cards_reviewed: totals.cardsReviewed,
      blocks_completed: totals.blocksCompleted,
      videos_completed: totals.videosCompleted,
      xp_earned: totals.xpEarned,
    },
    { onConflict: 'user_id,date' },
  )

  if (error) throw new Error(`daily_activity yazılamadı: ${error.message}`)

  const streak = meetsStreakThreshold(totals) ? await advanceStreak(adminClient, userId, now) : null

  return { date, totals, streak }
}

/** Fırlatmayan sarmalayıcı: hata loglanır, çağıranın işlemi devam eder. */
export async function recordStudyActivityQuietly(
  adminClient: DataClient,
  userId: string,
  delta: StudyActivityDelta,
  now: Date = new Date(),
): Promise<RecordActivityResult | null> {
  try {
    return await recordStudyActivity(adminClient, userId, delta, now)
  } catch (error) {
    console.error('[activity] günlük aktivite yazılamadı:', error)
    return null
  }
}

/* ------------------------------------------------------------------------- *
 * Yardımcılar
 * ------------------------------------------------------------------------- */

async function readTotals(
  client: DataClient,
  userId: string,
  date: string,
): Promise<ActivityTotals> {
  const { data, error } = await client
    .from('daily_activity')
    .select(
      'study_seconds, questions_answered, cards_reviewed, blocks_completed, videos_completed, xp_earned',
    )
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw new Error(`daily_activity okunamadı: ${error.message}`)
  if (!data) return EMPTY_TOTALS

  return {
    studySeconds: data.study_seconds ?? 0,
    questionsAnswered: data.questions_answered ?? 0,
    cardsReviewed: data.cards_reviewed ?? 0,
    blocksCompleted: data.blocks_completed ?? 0,
    videosCompleted: data.videos_completed ?? 0,
    xpEarned: data.xp_earned ?? 0,
  }
}

/**
 * Seriyi core'un `updateStreak` fonksiyonuyla ilerletir.
 *
 * Aynı gün içinde ikinci çağrı seriyi ARTIRMAZ (`incremented: false`) — core
 * bunu kendisi ayırt eder, burada tekrar denetlenmez. Profil yalnızca gerçek
 * bir değişiklik varsa yazılır.
 */
async function advanceStreak(
  client: DataClient,
  userId: string,
  now: Date,
): Promise<StreakState | null> {
  const { data, error } = await client
    .from('profiles')
    .select('current_streak, longest_streak, last_study_date')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null

  const next = updateStreak(
    {
      currentStreak: data.current_streak ?? 0,
      longestStreak: data.longest_streak ?? 0,
      lastStudyDate: data.last_study_date ?? null,
    },
    now,
  )

  const unchanged =
    next.currentStreak === (data.current_streak ?? 0) &&
    next.longestStreak === (data.longest_streak ?? 0) &&
    next.lastStudyDate === (data.last_study_date ?? null)

  if (unchanged) return next

  const { error: writeError } = await client
    .from('profiles')
    .update({
      current_streak: next.currentStreak,
      longest_streak: next.longestStreak,
      last_study_date: next.lastStudyDate,
    })
    .eq('id', userId)

  if (writeError) throw new Error(`seri güncellenemedi: ${writeError.message}`)
  return next
}
