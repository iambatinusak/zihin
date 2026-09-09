'use server'

import { revalidatePath } from 'next/cache'
import { XP_TABLE, levelForXp, sm2 } from '@zihin/core'
import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { isRewardableReview, toCardStateFromReview } from '@/lib/cards/queue'
import { generateCardsFromWrongAnswers } from '@/lib/cards/generate'
import { recordStudyActivityQuietly } from '@/lib/activity/record'
import { evaluateAndAwardBadgesQuietly } from '@/lib/gamification/award'
import { findReviewableCard, getCardReview, upsertCardReview } from '@/lib/data/cards'
import { getSession } from '@/lib/data/test'
import { AddWrongAnswersToCardsSchema, ReviewCardSchema } from './schemas'

/**
 * Hafıza kartı mutasyonları (spec §M9).
 *
 * SM-2 BURADA YAZILMAZ: `@zihin/core`'un `sm2` fonksiyonu çağrılır ve "şimdi"
 * ona açıkça geçilir (core saat bilmez, CONVENTIONS §5).
 *
 * Yetki her action'ın kendi işidir; düzenin guard'ı bir Server Action'ı
 * korumaz.
 */

/**
 * Bir kart tekrarının günlük çalışma sayacına yazılan süresi.
 * Ölçüm yok (kart ekranı süre göndermiyor); 20 saniye kasten DÜŞÜK seçildi —
 * seri eşiği (15 dakika) tahminle değil gerçek çalışmayla dolsun.
 */
const SECONDS_PER_CARD_REVIEW = 20

export type ReviewCardResult = {
  flashcardId: string
  /** Kartın bir sonraki tekrar zamanı (ISO). */
  nextReviewAt: string
  intervalDays: number
  /** Bu tekrar için verilen puan. Vadesi gelmemiş kart 0 alır. */
  awardedXp: number
}

/**
 * Bir kartı puanlar ve SM-2 durumunu günceller.
 *
 * PUAN SUNUCUDA HAK EDİLİR: XP yalnızca kartın vadesi GERÇEKTEN gelmişken
 * verilir. Aksi hâlde istemci aynı kartı arka arkaya "Kolay" diye gönderip
 * sınırsız puan toplayabilirdi (Faz 3'te `completeVideo` tam olarak bu hatayı
 * yapmıştı). Puanlanan kartın vadesi geleceğe atıldığı için ikinci çağrı
 * kendiliğinden 0 puan alır.
 */
export const reviewCard = action(ReviewCardSchema, async (input): Promise<ReviewCardResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  // Sahiplik/görünürlük denetimi: RLS başkasının kişisel kartını döndürmez,
  // satır yoksa istek reddedilir.
  const card = await findReviewableCard(supabase, input.flashcardId)
  if (!card) throw new AppError('not_found', 'Aradığınız kart bulunamadı.')

  const now = new Date()
  const existing = await getCardReview(supabase, user.id, input.flashcardId)

  const previousState = toCardStateFromReview(
    existing
      ? {
          easeFactor: Number(existing.ease_factor),
          intervalDays: existing.interval_days,
          repetitions: existing.repetitions,
          nextReviewAt: existing.next_review_at,
          lastGrade: existing.last_grade,
        }
      : null,
    // Tekrar satırı yoksa kart hiç çalışılmamıştır ve hemen vadelidir.
    now.toISOString(),
    now,
  )

  const wasDue = isRewardableReview(previousState.nextReviewAt, now)

  const next = sm2(previousState, input.grade, now)

  await upsertCardReview(supabase, {
    userId: user.id,
    flashcardId: card.flashcardId,
    easeFactor: next.easeFactor,
    intervalDays: next.intervalDays,
    repetitions: next.repetitions,
    nextReviewAt: next.nextReviewAt.toISOString(),
    lastGrade: input.grade,
    lastReviewedAt: now.toISOString(),
  })

  const awardedXp = wasDue ? await awardCardXp(user.id, card.flashcardId) : 0

  // Günlük aktivite (spec §M13). Vadesi gelmemiş kart sayaca da girmez: aksi
  // hâlde aynı kart döngüye alınıp "bugün çalıştım" eşiği uydurulabilirdi.
  // Süre kartın kendisinden ölçülemiyor; sabit ve mütevazı bir tahmin yazılır.
  if (wasDue) {
    await recordStudyActivityQuietly(createSupabaseAdminClient(), user.id, {
      cards: 1,
      seconds: SECONDS_PER_CARD_REVIEW,
      xp: awardedXp,
    })
    // Rozet bağlamı değişti (tekrar sayısı, belki seri): değerlendirme sessiz.
    await evaluateAndAwardBadgesQuietly(createSupabaseAdminClient(), user.id)
  }

  return {
    flashcardId: card.flashcardId,
    nextReviewAt: next.nextReviewAt.toISOString(),
    intervalDays: next.intervalDays,
    awardedXp,
  }
})

/**
 * Kart başına 1 XP (`XP_TABLE.card_reviewed`).
 *
 * `xp_events` RLS'te yalnızca service-role'a açıktır (CONVENTIONS §6).
 * `idx_xp_events_once` kısmi tekil indeksi `card_reviewed` olaylarını KAPSAMAZ:
 * aynı kart her tekrarda yeniden puan kazandırır — kötüye kullanımı engelleyen
 * şey vade denetimidir, indeks değil.
 */
async function awardCardXp(userId: string, flashcardId: string): Promise<number> {
  const amount = XP_TABLE.card_reviewed
  const admin = createSupabaseAdminClient()

  const { error } = await admin.from('xp_events').insert({
    user_id: userId,
    amount,
    reason: 'card_reviewed',
    ref_type: 'flashcard',
    ref_id: flashcardId,
  })

  if (error) {
    console.error('[reviewCard] xp_events yazılamadı:', error)
    return 0
  }

  // profiles.xp denormalize toplamdır; tek gerçek kaynak xp_events.
  const { data: profile } = await admin.from('profiles').select('xp').eq('id', userId).maybeSingle()
  const total = (profile?.xp ?? 0) + amount
  await admin
    .from('profiles')
    .update({ xp: total, level: levelForXp(total).level })
    .eq('id', userId)

  return amount
}

export type AddWrongAnswersResult = {
  created: number
  skipped: number
}

/**
 * Bitmiş bir test oturumundaki yanlışlardan hafıza kartı üretir (spec §M9).
 *
 * Oturumun sahibi olmayan biri başkasının yanlışlarından kart üretemez:
 * `getSession` kullanıcı kimliğiyle sorgulanır. Oturum bitmemişse reddedilir —
 * test sürerken kart üretmek, doğru cevabı kart olarak sızdırmak demektir.
 */
export const addWrongAnswersToCards = action(
  AddWrongAnswersToCardsSchema,
  async (input): Promise<AddWrongAnswersResult> => {
    const user = await assertRole('student')
    const supabase = await createSupabaseServerClient()

    const session = await getSession(supabase, input.sessionId, user.id)
    if (session.finished_at === null) {
      throw new AppError('forbidden', 'Kart üretmek için önce testi bitirmelisiniz.')
    }

    const result = await generateCardsFromWrongAnswers(
      createSupabaseAdminClient(),
      user.id,
      session.id,
    )

    revalidatePath('/kartlar')
    return result
  },
)
