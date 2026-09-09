'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminTopic, getPublishedQuestionIdsForTopics } from '@/lib/data/admin-media'
import { pickRandom } from '@/lib/media/allocation'
import {
  AddTestQuestionSchema,
  CreateTestSchema,
  DeleteTestSchema,
  RemoveTestQuestionSchema,
  ReorderTestQuestionsSchema,
  SetTestPublishedSchema,
  UpdateTestSchema,
} from './schemas'

/**
 * Konu ve ünite testleri (spec §M15).
 *
 * YETKİ: hepsi `assertRole(['editor', 'admin'])`. Test içeriktir; editörün
 * işidir. Denetim her action'ın kendi içindedir — `(admin)` düzeninin
 * `requireRole`u yalnızca sayfayı korur (CONVENTIONS §3).
 */

const LIST_PATH = '/admin/testler'

export type TestMutationResult = { id: string }

/**
 * Test oluşturur.
 *
 * ── RASTGELE KURAL NEDEN OLUŞTURMA ANINDA ÇÖZÜLÜR ──────────────────────────
 * "Bu konudan rastgele 20 soru" bir kural olarak SAKLANMAZ; kural burada bir
 * kez çalıştırılır ve seçilen sorular `test_questions` satırı olarak yazılır.
 * Kural çözme anında çalıştırılsaydı iki öğrenci aynı testte farklı sorular
 * görürdü; netleri, yüzdelikleri ve yetkinlik güncellemeleri kıyaslanamaz
 * hâle gelirdi. Testin içeriği oluşturulduğu anda dondurulur.
 *
 * Havuz istenenden kısa olabilir — bu bir hata değil, bu projede normal durum
 * (1164 konudan yalnızca üçünde soru var). Test o kadar soruyla kurulur;
 * havuz tamamen boşsa test kurulamaz ve editöre Türkçe hata döner.
 */
export const createTest = action(CreateTestSchema, async (input): Promise<TestMutationResult> => {
  await assertRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const topic = await getAdminTopic(supabase, input.topicId)

  let questionIds: string[]
  if (input.mode === 'random') {
    const pool = await getPublishedQuestionIdsForTopics(supabase, [topic.id])
    if (pool.length === 0) {
      throw new AppError('validation', 'Bu konuda yayımlanmış soru yok.', {
        randomCount: ['Bu konuda yayımlanmış soru yok.'],
      })
    }
    questionIds = pickRandom(pool, input.randomCount ?? 0)
  } else {
    questionIds = [...new Set(input.questionIds)]
  }

  if (questionIds.length === 0) {
    throw new AppError('validation', 'Testte en az bir soru olmalı.', {
      questionIds: ['Testte en az bir soru olmalı.'],
    })
  }

  const { data: test, error } = await supabase
    .from('tests')
    .insert({
      type: input.type,
      title: input.title,
      topic_id: topic.id,
      // Ünite testinde de konu bağı korunur; kapsam alanı ünitedir.
      unit_id: input.type === 'unit_test' ? topic.unitId : null,
      duration_seconds: input.durationMinutes === null ? null : input.durationMinutes * 60,
      is_published: input.isPublished,
    })
    .select('id')
    .single()

  if (error || !test) throw new AppError('internal', 'Test oluşturulamadı.')

  const { error: linkError } = await supabase.from('test_questions').insert(
    questionIds.map((questionId, index) => ({
      test_id: test.id,
      question_id: questionId,
      order_index: index,
      // Bölüm yalnızca denemede anlamlıdır; konu testinde null kalır.
      section: null,
    })),
  )

  if (linkError) throw new AppError('internal', 'Test soruları kaydedilemedi.')

  revalidatePath(LIST_PATH)
  return { id: test.id }
})

export const updateTest = action(UpdateTestSchema, async (input): Promise<TestMutationResult> => {
  await assertRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('tests')
    .update({
      title: input.title,
      duration_seconds: input.durationMinutes === null ? null : input.durationMinutes * 60,
      is_published: input.isPublished,
    })
    .eq('id', input.id)
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Test güncellenemedi.')

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${input.id}`)
  return { id: input.id }
})

export const setTestPublished = action(
  SetTestPublishedSchema,
  async (input): Promise<TestMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('tests')
      .update({ is_published: input.isPublished })
      .eq('id', input.id)
      .is('deleted_at', null)

    if (error) throw new AppError('internal', 'Yayın durumu değiştirilemedi.')

    revalidatePath(LIST_PATH)
    revalidatePath('/admin/denemeler')
    revalidatePath(`${LIST_PATH}/${input.id}`)
    return { id: input.id }
  },
)

/** Yumuşak silme (CONVENTIONS §6): çözülmüş oturumlar testi hâlâ işaret eder. */
export const deleteTest = action(DeleteTestSchema, async (input): Promise<TestMutationResult> => {
  await assertRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('tests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', input.id)
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Test silinemedi.')

  revalidatePath(LIST_PATH)
  revalidatePath('/admin/denemeler')
  return { id: input.id }
})

/**
 * Soru sırasını yeniden yazar.
 *
 * `test_questions` birleşik anahtarlı ve `order_index` dışında güncellenmez;
 * sıra tam liste olarak gelir ve satır satır yazılır. Bölüm (`section`) bilgisi
 * KORUNUR — denemede bölüm silinirse çözme ekranındaki sekmeler dağılır.
 */
export const reorderTestQuestions = action(
  ReorderTestQuestionsSchema,
  async (input): Promise<TestMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()

    for (const [index, questionId] of input.questionIds.entries()) {
      const { error } = await supabase
        .from('test_questions')
        .update({ order_index: index })
        .eq('test_id', input.testId)
        .eq('question_id', questionId)

      if (error) throw new AppError('internal', 'Soru sırası kaydedilemedi.')
    }

    revalidatePath(`${LIST_PATH}/${input.testId}`)
    revalidatePath('/admin/denemeler')
    return { id: input.testId }
  },
)

/**
 * Testten soru çıkarır.
 *
 * `test_questions` bir BAĞ tablosudur, içerik tablosu değil; yumuşak silme
 * kolonu yoktur ve satır fiziksel olarak silinir (CONVENTIONS §6).
 */
export const removeTestQuestion = action(
  RemoveTestQuestionSchema,
  async (input): Promise<TestMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('test_questions')
      .delete()
      .eq('test_id', input.testId)
      .eq('question_id', input.questionId)

    if (error) throw new AppError('internal', 'Soru testten çıkarılamadı.')

    revalidatePath(`${LIST_PATH}/${input.testId}`)
    return { id: input.testId }
  },
)

/** Var olan bir teste soru ekler; yeni soru listenin sonuna gider. */
export const addTestQuestion = action(
  AddTestQuestionSchema,
  async (input): Promise<TestMutationResult> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()

    const { data: rows, error: readError } = await supabase
      .from('test_questions')
      .select('order_index')
      .eq('test_id', input.testId)
      .order('order_index', { ascending: false })
      .limit(1)

    if (readError) throw new AppError('internal', 'Test soruları okunamadı.')
    const last = (rows ?? [])[0]

    const { error } = await supabase.from('test_questions').insert({
      test_id: input.testId,
      question_id: input.questionId,
      order_index: last ? last.order_index + 1 : 0,
      section: null,
    })

    if (error) {
      // 23505 = birleşik anahtar; soru zaten testte.
      if (error.code === '23505') {
        const message = 'Bu soru testte zaten var.'
        throw new AppError('conflict', message, { questionId: [message] })
      }
      throw new AppError('internal', 'Soru teste eklenemedi.')
    }

    revalidatePath(`${LIST_PATH}/${input.testId}`)
    return { id: input.testId }
  },
)
