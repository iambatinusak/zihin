'use server'

import { revalidatePath } from 'next/cache'
import { XP_TABLE, levelForXp } from '@zihin/core'
import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { DataClient } from '@/lib/data/client'
import { getMaxOrderIndex, getOwnedBlock } from '@/lib/data/plan'
import { generatePlanForUser } from '@/lib/plan/generate'
import { recordStudyActivityQuietly } from '@/lib/activity/record'
import { evaluateAndAwardBadgesQuietly } from '@/lib/gamification/award'
import { diffDays, isInWeek, weekStartOf, weekStartOfIso } from '@/lib/plan/week'
import { BlockIdSchema, MoveBlockSchema, RegeneratePlanSchema } from './schemas'

/**
 * Çalışma programının mutasyonları (spec §M8).
 *
 * BU DOSYANIN DEĞİŞMEZ KURALI: bir Server Action herkese açık bir uçtur.
 * Blok kimliği istemciden gelir, sahiplik ondan ÇIKARILMAZ — her action
 * `assertRole('student')` ile kimliği alır ve bloğu `user_id` eşitliğiyle
 * okur (`getOwnedBlock`). Başkasının bloğu ile hiç olmayan blok çağırana aynı
 * görünür; kimlik denemesiyle varlık sızdırılmaz.
 *
 * XP de istemciye bırakılmaz: `completeBlock` puanı yalnızca `completed_at`
 * damgasını ATAN çağrıda verir ve kayıt `xp_events` üzerindeki kısmi tekil
 * indekse (user_id, reason, ref_id) yaslanır. Faz 3'te `completeVideo` bu
 * denetimi atladığı için puan istemciden toplanabiliyordu; burada
 * tekrarlanmıyor.
 */

/** Blok "geçmiş" haftaya aitse yeniden üretilmez; geçmiş program dondurulur. */
function assertWeekIsEditable(weekStart: string, now: Date): void {
  if (diffDays(weekStart, weekStartOf(now)) < 0) {
    throw new AppError('forbidden', 'Geçmiş haftanın programı değiştirilemez.')
  }
}

export type RegeneratePlanResult = {
  weekStart: string
  planId: string | null
  blockCount: number
  preservedCount: number
  warnings: string[]
  /** Sınav seçilmediği için üretim atlandıysa true. */
  skipped: boolean
}

/**
 * Programı yeniden üretir. Tamamlanmış bloklar korunur, önceki plan silinmez
 * (ayrıntı: `lib/plan/generate.ts`).
 */
export const regeneratePlan = action(
  RegeneratePlanSchema,
  async (input): Promise<RegeneratePlanResult> => {
    const user = await assertRole('student')
    if (!user.examId) {
      throw new AppError('validation', 'Program oluşturmak için önce sınavınızı seçin.')
    }

    const now = new Date()
    const weekStart = input.weekStart ? weekStartOfIso(input.weekStart) : weekStartOf(now)
    assertWeekIsEditable(weekStart, now)

    // Service-role: `generatePlanForUser` cron ile aynı yolu kullanır ve
    // parametreleri doğrulanmış oturumdan alır (CONVENTIONS §4).
    const admin = createSupabaseAdminClient()
    const outcome = await generatePlanForUser(admin, user.id, input.template, {
      weekStart,
      now,
    })

    revalidatePath('/program')
    revalidatePath('/dashboard')

    if (outcome.status === 'skipped') {
      return {
        weekStart,
        planId: null,
        blockCount: 0,
        preservedCount: 0,
        warnings: [],
        skipped: true,
      }
    }

    return {
      weekStart: outcome.weekStart,
      planId: outcome.planId,
      blockCount: outcome.blockCount,
      preservedCount: outcome.preservedCount,
      warnings: outcome.warnings,
      skipped: false,
    }
  },
)

export type MoveBlockResult = {
  blockId: string
  scheduledDate: string
  orderIndex: number
  movedFromDate: string | null
}

/**
 * Bloğu başka bir güne taşır (sürükle-bırak ve "Başka güne taşı" menüsü aynı
 * action'ı çağırır).
 *
 * İki sınır: hedef gün bloğun PLANININ haftasında olmalı ve blok tamamlanmamış
 * olmalı. Hafta sınırı teknik değil anlamsal — bloklar aktif planın kimliğiyle
 * okunur; başka haftaya taşınan blok hiçbir ekranda görünmezdi.
 *
 * `moved_from_date` yalnızca İLK taşımada yazılır; ikinci taşımada üzerine
 * yazılsaydı "özgün gün" bilgisi kaybolurdu.
 */
export const moveBlock = action(MoveBlockSchema, async (input): Promise<MoveBlockResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const block = await getOwnedBlock(supabase, user.id, input.blockId)
  if (!block) throw new AppError('not_found', 'Program bloğu bulunamadı.')
  if (block.completedAt) {
    throw new AppError('conflict', 'Tamamlanmış bir blok taşınamaz.')
  }

  const plan = await getPlanOfBlock(supabase, user.id, block.planId)
  assertWeekIsEditable(plan.weekStart, new Date())

  if (!isInWeek(input.toDate, plan.weekStart)) {
    throw new AppError('validation', 'Blok yalnızca aynı haftanın günlerine taşınabilir.')
  }

  if (input.toDate === block.scheduledDate) {
    return {
      blockId: block.id,
      scheduledDate: block.scheduledDate,
      orderIndex: block.orderIndex,
      movedFromDate: block.movedFromDate,
    }
  }

  const orderIndex = (await getMaxOrderIndex(supabase, user.id, block.planId, input.toDate)) + 1
  const movedFromDate = block.movedFromDate ?? block.scheduledDate

  const { error } = await supabase
    .from('study_blocks')
    .update({
      scheduled_date: input.toDate,
      order_index: orderIndex,
      moved_from_date: movedFromDate,
    })
    .eq('id', block.id)
    .eq('user_id', user.id)

  if (error) throw new AppError('internal', 'Blok taşınamadı.')

  revalidatePath('/program')
  revalidatePath('/dashboard')

  return { blockId: block.id, scheduledDate: input.toDate, orderIndex, movedFromDate }
})

export type CompleteBlockResult = {
  blockId: string
  completedAt: string
  /** Damgayı bu çağrı attıysa true; ikinci çağrıda false. */
  firstCompletion: boolean
  awardedXp: number
}

/** Bloğu tamamlanmış işaretler ve puanı BİR KEZ verir. */
export const completeBlock = action(BlockIdSchema, async (input): Promise<CompleteBlockResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const block = await getOwnedBlock(supabase, user.id, input.blockId)
  if (!block) throw new AppError('not_found', 'Program bloğu bulunamadı.')

  if (block.completedAt) {
    return {
      blockId: block.id,
      completedAt: block.completedAt,
      firstCompletion: false,
      awardedXp: 0,
    }
  }

  const completedAt = new Date().toISOString()

  // `completed_at is null` koşulu güncellemenin İÇİNDE: eşzamanlı iki çağrıdan
  // yalnızca biri satır döndürür, puanı da o alır.
  const { data: updated, error } = await supabase
    .from('study_blocks')
    .update({ completed_at: completedAt })
    .eq('id', block.id)
    .eq('user_id', user.id)
    .is('completed_at', null)
    .select('id')

  if (error) throw new AppError('internal', 'Blok tamamlanamadı.')

  const firstCompletion = (updated ?? []).length > 0
  const awardedXp = firstCompletion ? await awardBlockXp(user.id, block.id) : 0

  // Günlük aktivite sayacı yalnızca İLK tamamlamada artar; işaret geri alınıp
  // yeniden konarak seri şişirilemesin. Süre bloğun PLANLANAN dakikasıdır —
  // istemciden gelen bir ölçüm değil (spec §M13).
  if (firstCompletion) {
    await recordStudyActivityQuietly(createSupabaseAdminClient(), user.id, {
      blocks: 1,
      seconds: (block.estimatedMinutes ?? 0) * 60,
      xp: awardedXp,
    })
    // Blok tamamlamak günlük eşiği geçirip seriyi ilerletebilir: rozet
    // değerlendirmesi bu yüzden burada da çalışır. Sessiz.
    await evaluateAndAwardBadgesQuietly(createSupabaseAdminClient(), user.id)
  }

  revalidatePath('/program')
  revalidatePath('/dashboard')

  return { blockId: block.id, completedAt, firstCompletion, awardedXp }
})

export type UncompleteBlockResult = { blockId: string }

/**
 * Tamamlama işaretini geri alır (yanlış tıklama).
 *
 * XP GERİ ALINMAZ: `xp_events` yalnızca eklenen bir olay tablosudur ve kısmi
 * tekil indeks aynı blok için ikinci bir kaydı zaten engeller — yani blok
 * tekrar tamamlansa da puan ikinci kez verilmez. İşareti geri alıp yeniden
 * koyarak puan biriktirmek mümkün değildir.
 */
export const uncompleteBlock = action(
  BlockIdSchema,
  async (input): Promise<UncompleteBlockResult> => {
    const user = await assertRole('student')
    const supabase = await createSupabaseServerClient()

    const block = await getOwnedBlock(supabase, user.id, input.blockId)
    if (!block) throw new AppError('not_found', 'Program bloğu bulunamadı.')

    const { error } = await supabase
      .from('study_blocks')
      .update({ completed_at: null })
      .eq('id', block.id)
      .eq('user_id', user.id)

    if (error) throw new AppError('internal', 'İşaret geri alınamadı.')

    revalidatePath('/program')
    revalidatePath('/dashboard')

    return { blockId: block.id }
  },
)

// ---------------------------------------------------------------------------
// İç yardımcılar
// ---------------------------------------------------------------------------

async function getPlanOfBlock(
  client: DataClient,
  userId: string,
  planId: string,
): Promise<{ id: string; weekStart: string }> {
  const { data, error } = await client
    .from('study_plans')
    .select('id, week_start')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Çalışma programı yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Çalışma programı bulunamadı.')
  return { id: data.id, weekStart: data.week_start }
}

/**
 * `block_completed` puanını yazar. Zaten yazılmışsa 0 döner.
 * `xp_events` RLS'te yalnızca service-role'a açıktır (CONVENTIONS §6).
 */
async function awardBlockXp(userId: string, blockId: string): Promise<number> {
  const amount = XP_TABLE.block_completed
  const admin = createSupabaseAdminClient()

  const { error } = await admin.from('xp_events').insert({
    user_id: userId,
    amount,
    reason: 'block_completed',
    ref_type: 'study_block',
    ref_id: blockId,
  })

  if (error) {
    // 23505 = tekil indeks ihlali: puan daha önce verilmiş. Beklenen sonuç.
    if ((error as { code?: string }).code === '23505') return 0
    console.error('[completeBlock] xp_events yazılamadı:', error)
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
