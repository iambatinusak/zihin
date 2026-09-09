'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { CreateFlashcardSchema, DeleteFlashcardSchema, UpdateFlashcardSchema } from './schemas'

/**
 * Editör bilgi kartları (spec §M15).
 *
 * YETKİ: `assertRole(['editor', 'admin'])`.
 *
 * ── EDİTÖR KARTI NEDİR ─────────────────────────────────────────────────────
 * `auto_generated = false` ve `created_by = null`. İkisi birlikte kartı HERKESE
 * açık yapar (0004_content.sql, `flashcards.created_by` yorumu). Öğrencinin
 * kendi yanlışından üretilen kartlar ise `auto_generated = true` ve sahibine
 * bağlıdır; bu ekrandan ne listelenir ne düzenlenir — düzenlenseydi hem
 * başkasının kişisel verisine dokunulmuş hem de sahibinin tekrar kuyruğu
 * bozulmuş olurdu. Bu yüzden HER yazma sorgusu `auto_generated = false`
 * süzgecini de taşır: kart kimliği elle değiştirilse bile otomatik bir karta
 * ulaşılamaz.
 */

const LIST_PATH = '/admin/kartlar'

export type FlashcardMutationResult = { id: string }

export const createFlashcard = action(
  CreateFlashcardSchema,
  async (input): Promise<FlashcardMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('flashcards')
      .insert({
        topic_id: input.topicId,
        front: input.front,
        back: input.back,
        image_url: input.imageUrl,
        is_published: input.isPublished,
        auto_generated: false,
        created_by: null,
        source_question_id: null,
      })
      .select('id')
      .single()

    if (error || !data) throw new AppError('internal', 'Kart kaydedilemedi.')

    revalidatePath(LIST_PATH)
    return { id: data.id }
  },
)

export const updateFlashcard = action(
  UpdateFlashcardSchema,
  async (input): Promise<FlashcardMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('flashcards')
      .update({
        topic_id: input.topicId,
        front: input.front,
        back: input.back,
        image_url: input.imageUrl,
        is_published: input.isPublished,
      })
      .eq('id', input.id)
      // Otomatik kart bu yoldan asla güncellenemez.
      .eq('auto_generated', false)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) throw new AppError('internal', 'Kart güncellenemedi.')
    if (!data) throw new AppError('not_found', 'Düzenlenecek kart bulunamadı.')

    revalidatePath(LIST_PATH)
    return { id: input.id }
  },
)

/** Yumuşak silme (CONVENTIONS §6): kartın tekrar geçmişi ayakta kalır. */
export const deleteFlashcard = action(
  DeleteFlashcardSchema,
  async (input): Promise<FlashcardMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('flashcards')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.id)
      .eq('auto_generated', false)
      .is('deleted_at', null)

    if (error) throw new AppError('internal', 'Kart silinemedi.')

    revalidatePath(LIST_PATH)
    return { id: input.id }
  },
)
