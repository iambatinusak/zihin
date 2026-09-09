'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSubjectPools } from '@/lib/data/admin-media'
import { allocateMockSections, pickRandom, type SectionRequest } from '@/lib/media/allocation'
import { CreateMockSchema } from './schemas'

/**
 * Deneme sınavı kurucusu (spec §M15).
 *
 * YETKİ: `assertRole(['editor', 'admin'])` — deneme de içeriktir.
 */

const LIST_PATH = '/admin/denemeler'

export type CreateMockResult = {
  id: string
  /** Denemeye gerçekten giren soru sayısı; havuz kısaysa istenenden azdır. */
  questionCount: number
  shortSections: { name: string; requested: number; taken: number }[]
}

/**
 * Denemeyi kurar ve sorularını AYNI ANDA sabitler.
 *
 * ── BÖLÜM ADI ──────────────────────────────────────────────────────────────
 * `test_questions.section` kolonuna dersin ADI yazılır (kimliği değil).
 * `lib/mock/sections.ts` çözme ekranındaki sekmeleri ve sonuçtaki ders
 * kırılımını tam olarak bu metne göre gruplar; ad ile kolon birbirinden
 * ayrılırsa deneme tek bir "Diğer" grubuna düşer.
 *
 * ── KISA HAVUZ ─────────────────────────────────────────────────────────────
 * İstenen sayıdan az soru bulunması HATA DEĞİLDİR; şu an 1164 konudan yalnızca
 * üçünde soru var, yani beklenen durum budur. Deneme bulunabilen soruyla
 * kurulur, kaç soruyla kurulduğu çağırana döner ve arayüzde uyarı olarak
 * gösterilir. Yalnızca hiç soru bulunamadığında işlem durur — sorusu olmayan
 * bir deneme çözülemez.
 */
export const createMockExam = action(CreateMockSchema, async (input): Promise<CreateMockResult> => {
  await assertRole(['editor', 'admin'])

  const supabase = await createSupabaseServerClient()
  const pools = await getSubjectPools(supabase, input.examId)
  const poolBySubject = new Map(pools.map((pool) => [pool.subjectId, pool]))

  const requests: SectionRequest[] = input.sections.flatMap((section) => {
    const pool = poolBySubject.get(section.subjectId)
    if (!pool) return []
    return [{ subjectId: pool.subjectId, subjectName: pool.subjectName, requested: section.count }]
  })

  const availability: Record<string, number> = {}
  for (const pool of pools) availability[pool.subjectId] = pool.questionIds.length

  const allocation = allocateMockSections(requests, availability)

  if (allocation.isEmpty) {
    throw new AppError(
      'validation',
      'Seçtiğiniz derslerin hiçbirinde yayımlanmış soru yok; deneme kurulamaz.',
      { sections: ['Seçtiğiniz derslerin hiçbirinde yayımlanmış soru yok.'] },
    )
  }

  const { data: test, error } = await supabase
    .from('tests')
    .insert({
      type: 'mock_exam',
      title: input.title,
      exam_id: input.examId,
      duration_seconds: input.durationMinutes === null ? null : input.durationMinutes * 60,
      publish_at: input.publishAt,
      live_window_start: input.liveWindowStart,
      live_window_end: input.liveWindowEnd,
      is_published: input.isPublished,
    })
    .select('id')
    .single()

  if (error || !test) throw new AppError('internal', 'Deneme oluşturulamadı.')

  // Sorular ŞİMDİ seçilir ve satır olarak yazılır. Seçim çözme anına
  // bırakılsaydı iki öğrenci farklı sorular görür, netleri kıyaslanamazdı.
  const rows: { test_id: string; question_id: string; order_index: number; section: string }[] = []
  let orderIndex = 0

  for (const section of allocation.sections) {
    const pool = poolBySubject.get(section.subjectId)
    if (!pool) continue
    for (const questionId of pickRandom(pool.questionIds, section.taken)) {
      rows.push({
        test_id: test.id,
        question_id: questionId,
        order_index: orderIndex,
        section: section.subjectName,
      })
      orderIndex += 1
    }
  }

  const { error: linkError } = await supabase.from('test_questions').insert(rows)
  if (linkError) throw new AppError('internal', 'Deneme soruları kaydedilemedi.')

  revalidatePath(LIST_PATH)

  return {
    id: test.id,
    questionCount: rows.length,
    shortSections: allocation.sections
      .filter((section) => section.shortfall > 0)
      .map((section) => ({
        name: section.subjectName,
        requested: section.requested,
        taken: section.taken,
      })),
  }
})
