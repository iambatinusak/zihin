'use server'

import { actionNoInput } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  createPlacementTest,
  findResumablePlacementSession,
  getPlacementCandidates,
  getPlacementStatus,
} from '@/lib/data/placement'
import { insertSession } from '@/lib/data/test'
import {
  buildPlacementSelection,
  PLACEMENT_TARGET_TOTAL,
  type PlacementSelection,
} from '@/lib/placement/select'

/**
 * Seviye tespit sınavının başlatılması (spec §M7).
 *
 * Kendi çözme ekranı YOKTUR: bu action bir oturum açar ve arayüz kullanıcıyı
 * var olan `/test/[sessionId]` motoruna götürür. Sınavın "seviye tespit"
 * olduğu tek işaret `test_sessions.is_placement`; yetkinlik hesabı ve rozetler
 * o bayrağı okur.
 *
 * ATLAMA bir action değildir: spec §M7'ye göre atlayan öğrencinin bütün
 * konuları `unknown` kalır — yani yapılacak hiçbir yazma yoktur. Arayüzdeki
 * "Şimdilik geç" bağlantısı sadece panele döner.
 */

export type StartPlacementResult = {
  sessionId: string
  /** Var olan yarım oturuma mı dönüldü? */
  resumed: boolean
  questionCount: number
  /** Havuz 20 soruya yetmediyse arayüz kullanıcıyı uyarır. */
  short: boolean
}

export const startPlacementTest = actionNoInput(async (): Promise<StartPlacementResult> => {
  const user = await assertRole('student')

  // Sınav kimliği İSTEMCİDEN GELMEZ: profildeki hedef sınav kullanılır. Bir
  // Server Action herkese açık bir uç noktadır; öğrenci başka bir sınavın
  // sorularını kendi seviye tespitine yazdıramamalı (CONVENTIONS §2).
  const examId = user.examId
  if (!examId) {
    throw new AppError('validation', 'Önce hedef sınavınızı seçmelisiniz.')
  }

  const supabase = await createSupabaseServerClient()

  // Yarım kalan oturum varsa YENİSİ AÇILMAZ; test motorunun kuralı burada da
  // geçerli (spec §M5) — yenilenen sayfa ikinci bir sınav başlatmasın.
  // TEK SEFERLİK (spec §M7): tamamlanmış bir seviye tespit varsa ikincisi
  // açılmaz. Arayüz düğmeyi zaten gizliyor ama bir Server Action herkese açık
  // bir uçtur; denetim olmasaydı çağrı döngüye alınıp sınırsız `tests` ve
  // `test_sessions` satırı üretilebilir, yetkinlik geçmişi de bozulabilirdi.
  const status = await getPlacementStatus(supabase, user.id)
  if (status.completed) {
    throw new AppError('conflict', 'Seviye tespit sınavını zaten tamamladınız.')
  }

  const resumable = await findResumablePlacementSession(supabase, user.id)
  if (resumable) {
    return {
      sessionId: resumable.id,
      resumed: true,
      questionCount: resumable.question_order.length,
      short: false,
    }
  }

  const { subjects, questionsBySubject } = await getPlacementCandidates(supabase, examId)

  // Tohum her başlatmada yeni: aynı öğrenci sınavı tekrar alırsa aynı 25
  // soruyla karşılaşmasın. Seçim tohum verildiğinde deterministiktir, yani
  // bir hatayı yeniden üretmek için tohumu sabitlemek yeter.
  const selection: PlacementSelection = buildPlacementSelection(
    subjects,
    questionsBySubject,
    PLACEMENT_TARGET_TOTAL,
    { seed: crypto.randomUUID() },
  )

  if (selection.questionIds.length === 0) {
    throw new AppError('not_found', 'Bu sınav için henüz seviye tespit sorusu bulunmuyor.')
  }

  // `tests` satırını yalnızca service-role açabilir: içerik tablosu öğrenciye
  // yazma izni vermez (CONVENTIONS §4).
  const test = await createPlacementTest(createSupabaseAdminClient(), {
    examId,
    userId: user.id,
    title: 'Seviye Tespit Sınavı',
    questionIds: selection.questionIds,
  })

  // Oturum kullanıcının KENDİ istemcisiyle açılır ki RLS sahipliği doğrulasın.
  // Soru sırası yeniden karıştırılmaz: seçim zaten derse göre gruplanmış
  // hâlde geliyor ve öğrenci sınavı ders ders ilerlesin.
  const session = await insertSession(supabase, {
    userId: user.id,
    testId: test.id,
    questionOrder: selection.questionIds,
    isPlacement: true,
  })

  return {
    sessionId: session.id,
    resumed: false,
    questionCount: selection.questionIds.length,
    short: selection.short,
  }
})
