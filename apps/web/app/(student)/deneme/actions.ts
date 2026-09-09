'use server'

import { calculateMockSummary } from '@zihin/core'
import type { MockAttemptInput, MockSectionInput, MockSummary } from '@zihin/core'
import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { startTest } from '@/app/(student)/test/actions'
import {
  getSession,
  getSessionAttempts,
  getTestById,
  getTestQuestions,
  getWrongPenaltyDivisor,
} from '@/lib/data/test'
import { getFinishedMockNets, setSessionPercentile } from '@/lib/data/mock'
import { canRevealAnswers } from '@/lib/test-engine/session'
import { groupSections } from '@/lib/mock/sections'
import { buildNetPopulation, buildPercentileView, type PercentileView } from '@/lib/mock/percentile'
import { isRankingVisible, mockWindowState, type MockWindowState } from '@/lib/mock/window'
import type { MockStrings } from '@/components/mock/strings'
import { section } from '@/lib/i18n'
import { GetMockResultSchema, StartMockSchema } from './schemas'

/**
 * Deneme sınavının mutasyonları (spec §M10).
 *
 * BU DOSYA İKİNCİ BİR OTURUM YAŞAM DÖNGÜSÜ KURMAZ. Oturum açma, cevap kaydı ve
 * bitirme `app/(student)/test/actions.ts` içindeki motorun işidir; `startMock`
 * yalnızca denemeye özgü ön koşulları (tip, canlı pencere) doğrulayıp `startTest`
 * çağırır, çözme ekranı da doğrudan `submitAnswer`/`finishTest` kullanır.
 * `attempts.source` böylece kendiliğinden `'mock_exam'` olur: `submitAnswer`
 * kaynağı `tests.type` alanından yazıyor.
 *
 * Canlı pencere denetimi İKİ YERDEDİR: burada (kullanıcıya doğru mesajı vermek
 * için) ve `startTest` içindeki `assertTestAccess`'te (asıl kapı). Bir Server
 * Action herkese açık bir uç noktadır; düğmeyi gizlemek denetim değildir.
 */

export type StartMockResult = {
  sessionId: string
  resumed: boolean
}

/**
 * Denemeyi başlatır ya da yarım kalan oturumu sürdürür.
 *
 * Sürdürme kuralını motor uygular: bitmemiş ve süresi dolmamış bir oturum varsa
 * yenisi açılmaz, soru sırası da yeniden hesaplanmaz.
 */
export const startMock = action(StartMockSchema, async (input): Promise<StartMockResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const test = await getTestById(supabase, input.testId)
  if (test.type !== 'mock_exam' || !test.is_published) {
    throw new AppError('not_found', 'Aradığınız deneme bulunamadı.')
  }

  // Kullanıcı hedef sınavı dışındaki bir denemeye elle girmeye çalışabilir;
  // içerik kilidi değil, doğru ekranı göstermek için engellenir.
  if (test.exam_id !== null && user.examId !== null && test.exam_id !== user.examId) {
    throw new AppError('forbidden', 'Bu deneme hedeflediğiniz sınava ait değil.')
  }

  // Asıl pencere kapısı `startTest` içinde; burada yalnızca erken ve anlaşılır
  // bir hata üretiliyor.
  const windowState = mockWindowState(test, new Date())
  if (windowState === 'before') {
    throw new AppError('forbidden', 'Bu deneme henüz başlamadı. Yayın saatinde tekrar deneyin.')
  }
  if (windowState === 'closed') {
    throw new AppError('forbidden', 'Bu denemenin katılım süresi doldu.')
  }

  const started = await startTest({ testId: test.id })
  if (!started.ok) {
    throw new AppError(started.error.code, started.error.message, started.error.fieldErrors)
  }

  return { sessionId: started.data.sessionId, resumed: started.data.resumed }
})

export type MockResult = {
  sessionId: string
  testId: string
  testTitle: string
  finishedAt: string
  summary: MockSummary
  windowState: MockWindowState
  /** Sıralama açıldı mı? Canlı pencere sürerken dilim gösterilmez. */
  rankingVisible: boolean
  /** Sıralama kapalıyken null; açıkken yeterli veri olup olmadığını da söyler. */
  percentile: PercentileView | null
}

/**
 * Deneme sonucu: ders bazlı net, genel net ve yüzdelik dilim.
 *
 * Oturum BİTMEMİŞSE reddedilir — `canRevealAnswers` tek kapıdır ve konu
 * testiyle aynı yüklemdir. Burada cevap anahtarı OKUNMAZ: doğru/yanlış kararı
 * `attempts.is_correct` içinde zaten kayıtlıdır, dolayısıyla bu action doğru
 * şıkkı hiç görmez. Soru çözümleri ayrı bir kapıdan (`getResult`) gelir.
 *
 * Net hesabı `calculateMockSummary` ile yapılır; bu dosyada net formülü yoktur.
 */
export const getMockResult = action(GetMockResultSchema, async (input): Promise<MockResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const session = await getSession(supabase, input.sessionId, user.id)
  if (!canRevealAnswers(session)) {
    throw new AppError('forbidden', 'Sonuçları görmek için önce denemeyi bitirmelisiniz.')
  }

  const test = await getTestById(supabase, session.test_id)
  if (test.type !== 'mock_exam') {
    throw new AppError('not_found', 'Bu oturum bir denemeye ait değil.')
  }

  const questions = await getTestQuestions(supabase, test.id)
  const byId = new Map(questions.map((question) => [question.id, question]))

  // Yalnızca bu OTURUMUN sırasındaki sorular sayılır. Kısmen dolu bir deneme
  // (havuzda 90 sorunun 20'si var) burada doğal olarak doğru okunur: bölüm
  // toplamları oturumdaki soru sayısıdır, hedeflenen sayı değil.
  const scoped = session.question_order.flatMap((questionId) => {
    const question = byId.get(questionId)
    return question ? [{ questionId: question.id, section: question.section }] : []
  })

  const sections: MockSectionInput[] = groupSections(
    scoped,
    section<MockStrings>('mock').otherSubject,
  ).map((group) => ({
    subjectId: group.key,
    subjectName: group.name,
    questionIds: group.questionIds,
  }))

  const attempts = await getSessionAttempts(supabase, session.id, user.id)
  const mockAttempts: MockAttemptInput[] = attempts.map((attempt) => ({
    questionId: attempt.question_id,
    selectedOption: attempt.selected_option,
    isCorrect: attempt.is_correct,
    topicId: attempt.topic_id,
  }))

  const divisor = await getWrongPenaltyDivisor(supabase, test.exam_id)
  const summary = calculateMockSummary(sections, mockAttempts, {
    divisor,
    durationSeconds: test.duration_seconds,
  })

  const windowState = mockWindowState(test, new Date())
  const rankingVisible = isRankingVisible(windowState)

  const percentile = rankingVisible
    ? await resolvePercentile({
        testId: test.id,
        sessionId: session.id,
        userId: user.id,
        net: summary.net,
        stored: session.percentile === null ? null : Number(session.percentile),
      })
    : null

  return {
    sessionId: session.id,
    testId: test.id,
    testTitle: test.title,
    finishedAt: session.finished_at,
    summary,
    windowState,
    rankingVisible,
    percentile,
  }
})

/**
 * Dilimi hesaplar ve oturuma yazar.
 *
 * Dağılım SUNUCUDA kurulur: bu denemeyi bitirmiş tüm oturumların netleri
 * service-role istemcisiyle okunur (öğrenci başkalarının oturumlarını göremez).
 * Liste `buildNetPopulation` içinde KATILIMCI BAŞINA TEK NETE indirgenir —
 * deneme yeniden çözülebildiği için aynı öğrencinin birden çok bitmiş oturumu
 * olabilir ve bunlar ayrı katılımcı sayılamaz. Kullanıcının kendi oturumlarının
 * hepsi çıkarılıp yerlerine bu istekte hesaplanan taze net konur.
 *
 * 20 katılımcının altında `calculatePercentile` null döner ve ekran "yeterli
 * veri yok" der (spec §15). Yazma yalnızca değer DEĞİŞTİYSE yapılır; sonuç
 * sayfasının her açılışı gereksiz bir UPDATE üretmesin.
 */
async function resolvePercentile(input: {
  testId: string
  sessionId: string
  userId: string
  net: number
  stored: number | null
}): Promise<PercentileView> {
  const admin = createSupabaseAdminClient()

  const participants = await getFinishedMockNets(admin, input.testId).catch((error: unknown) => {
    // Dilim hesaplanamaması sonucun kalanını kaybettirmemeli.
    console.error('[mock] katılımcı netleri okunamadı:', error)
    return []
  })

  const view = buildPercentileView(
    input.net,
    buildNetPopulation(participants, {
      sessionId: input.sessionId,
      userId: input.userId,
      net: input.net,
    }),
  )

  if (view.status === 'ready' && view.percentile !== input.stored) {
    try {
      await setSessionPercentile(admin, {
        sessionId: input.sessionId,
        userId: input.userId,
        percentile: view.percentile,
      })
    } catch (error) {
      console.error('[mock] yüzdelik dilim yazılamadı:', error)
    }
  }

  return view
}
