'use server'

import { z } from 'zod'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { searchAdminQuestions, type QuestionOption } from '@/lib/data/admin-media'

/**
 * Soru arama — durak seçicisi ve test kurucusu aynı seçiciyi kullanır.
 *
 * Rotalardan birine bağlı değil, çünkü iki farklı rota grubu (`videolar`,
 * `testler`) tarafından çağrılıyor; birinin klasöründe durup diğerinden
 * içe aktarılması sahiplik sınırını bulanıklaştırırdı.
 *
 * OKUMA da olsa bir Server Action'dır ve kendi yetki denetimini yapar:
 * soru kökleri yayımlanmamış taslakları da içerir, öğrenciye açık değildir.
 */

const SearchQuestionsSchema = z.object({
  topicIds: z.array(z.string().uuid()).max(200).optional(),
  text: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const searchQuestions = action(
  SearchQuestionsSchema,
  async (input): Promise<QuestionOption[]> => {
    await assertRole(['editor', 'admin'])

    const supabase = await createSupabaseServerClient()
    return searchAdminQuestions(supabase, {
      topicIds: input.topicIds,
      text: input.text ?? null,
      limit: input.limit ?? 30,
    })
  },
)
