'use server'

import { revalidatePath } from 'next/cache'
import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { hasActiveSubscription } from '@/lib/data/catalog'
import { recalculateQuietly } from '@/lib/mastery/recalculate'
import { generateCardsQuietly } from '@/lib/cards/generate'
import { recordStudyActivityQuietly } from '@/lib/activity/record'
import { evaluateAndAwardBadgesQuietly } from '@/lib/gamification/award'
import {
  countPriorAttempts,
  createQuickPracticeTest,
  deleteBookmark,
  findQuickPracticeTest,
  findSessionAttempt,
  finishSession,
  getActiveSession,
  getBookmarkedQuestionIds,
  getExamIdForTopic,
  getPublishedQuestionIdsForTopic,
  getSession,
  getSessionAttempts,
  getTestById,
  getTestQuestions,
  getWeakestTopics,
  getWrongPenaltyDivisor,
  insertAttempt,
  insertSession,
  readAnswerKey,
  updateAttempt,
  upsertBookmark,
  type PublicQuestion,
  type TestRow,
  type TestSessionRow,
} from '@/lib/data/test'
import { isMockStartable, mockWindowState } from '@/lib/mock/window'
import {
  buildQuestionOrder,
  canRevealAnswers,
  isSessionResumable,
  summarise,
  type SummaryAttempt,
  type TestSummary,
} from '@/lib/test-engine/session'
import {
  BookmarkQuestionSchema,
  FinishTestSchema,
  GetResultSchema,
  RemoveBookmarkSchema,
  StartTestSchema,
  SubmitAnswerSchema,
} from './schemas'

/**
 * Test motorunun mutasyonları.
 *
 * BU DOSYANIN TEK DEĞİŞMEZ KURALI: test devam ederken doğru cevap tarayıcıya
 * GİTMEZ. `submitAnswer` sunucuda puanlar ama yalnızca `{ saved: true }` döner;
 * doğru şık, açıklama ve çözüm videosu sadece `getResult` üzerinden, sadece
 * `finished_at` dolu bir oturum için verilir. Cevap anahtarını okuyan tek
 * istemci service-role istemcisidir (`createSupabaseAdminClient`); normal
 * oturum istemcisiyle o kolonlar zaten okunamaz.
 *
 * Yetki her action'ın kendi işidir: bir Server Action doğrudan çağrılabilir,
 * düzenin guard'ı onu korumaz (CONVENTIONS §3).
 */

/** Hızlı tekrarda bir oturumda sorulan soru sayısı (spec §M5). */
const QUICK_PRACTICE_QUESTION_COUNT = 5

/** Yetkinlik verisi henüz yokken hızlı tekrar için taranacak en fazla konu. */
const WEAK_TOPIC_SCAN_LIMIT = 20

export type StartTestResult = {
  sessionId: string
  testId: string
  testTitle: string
  questionOrder: string[]
  /** Yarım kalan bir oturuma dönüldü mü? Arayüz kullanıcıya bunu söyler. */
  resumed: boolean
  /** Sürdürülen oturumda daha önce cevaplanmış soruların kimlikleri. */
  answeredQuestionIds: string[]
  durationSeconds: number | null
  startedAt: string
  expiresAt: string
}

/**
 * Testi başlatır ya da yarım kalanı sürdürür.
 *
 * Sürdürme kuralı: bu test için bitmemiş ve süresi dolmamış bir oturum varsa
 * YENİSİ AÇILMAZ, mevcut oturum `resumed: true` ile döner. Soru sırası da
 * yeniden hesaplanmaz, `question_order` kolonundan okunur (spec §M5).
 */
export const startTest = action(StartTestSchema, async (input): Promise<StartTestResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const { test, questionPool } =
    'testId' in input
      ? await resolveExistingTest(supabase, input.testId)
      : await resolveQuickPracticeTest(supabase, user.id, input.topicId ?? null, user.examId)

  await assertTestAccess(supabase, user.id, test)

  if (questionPool.length === 0) {
    throw new AppError('not_found', 'Bu testte çözülebilecek soru bulunmuyor.')
  }

  const existing = await getActiveSession(supabase, user.id, test.id)
  if (existing && isSessionResumable(existing, new Date())) {
    const attempts = await getSessionAttempts(supabase, existing.id, user.id)
    return toStartResult(test, existing, {
      resumed: true,
      answeredQuestionIds: attempts.map((attempt) => attempt.question_id),
    })
  }

  // Tohum oturumdan bağımsız üretilir: aynı testi tekrar çözen öğrenci aynı
  // sırayla karşılaşmasın. Sıra bir kez hesaplanıp kolona yazılır ve sürdürmede
  // yeniden üretilmez.
  const seed = crypto.randomUUID()
  const shuffled = buildQuestionOrder(questionPool, seed)
  const questionOrder =
    test.type === 'quick_practice' ? shuffled.slice(0, QUICK_PRACTICE_QUESTION_COUNT) : shuffled

  const session = await insertSession(supabase, {
    userId: user.id,
    testId: test.id,
    questionOrder,
  })

  return toStartResult(test, session, { resumed: false, answeredQuestionIds: [] })
})

function toStartResult(
  test: TestRow,
  session: TestSessionRow,
  extra: { resumed: boolean; answeredQuestionIds: string[] },
): StartTestResult {
  return {
    sessionId: session.id,
    testId: test.id,
    testTitle: test.title,
    questionOrder: session.question_order,
    resumed: extra.resumed,
    answeredQuestionIds: extra.answeredQuestionIds,
    durationSeconds: test.duration_seconds,
    startedAt: session.started_at,
    expiresAt: session.expires_at,
  }
}

/** Var olan bir testi ve soru havuzunu getirir. */
async function resolveExistingTest(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  testId: string,
): Promise<{ test: TestRow; questionPool: string[] }> {
  const test = await getTestById(supabase, testId)
  if (!test.is_published) {
    throw new AppError('not_found', 'Aradığınız test bulunamadı.')
  }

  const questions = await getTestQuestions(supabase, test.id)
  return { test, questionPool: questions.map((question) => question.id) }
}

/**
 * Hızlı tekrar: konu verilmemişse kullanıcının EN ZAYIF, soru bulunan konusu
 * seçilir (spec §M5). Konu başına tek bir `quick_practice` test satırı tutulur
 * (gerekçesi `findQuickPracticeTest` yorumunda); yoksa service-role ile açılır.
 */
async function resolveQuickPracticeTest(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  requestedTopicId: string | null,
  userExamId: string | null,
): Promise<{ test: TestRow; questionPool: string[] }> {
  let topicId = requestedTopicId
  let questionPool: string[] = []

  if (topicId) {
    questionPool = await getPublishedQuestionIdsForTopic(supabase, topicId)
  } else {
    const weakest = await getWeakestTopics(supabase, userId, WEAK_TOPIC_SCAN_LIMIT)
    // En zayıftan başlayıp SORUSU OLAN ilk konuda durulur; içeriği hazır
    // olmayan bir konu için boş bir oturum açmanın anlamı yok.
    for (const candidate of weakest) {
      const pool = await getPublishedQuestionIdsForTopic(supabase, candidate.topicId)
      if (pool.length > 0) {
        topicId = candidate.topicId
        questionPool = pool
        break
      }
    }
  }

  if (!topicId || questionPool.length === 0) {
    throw new AppError(
      'not_found',
      'Hızlı tekrar için uygun bir konu bulunamadı. Önce birkaç test çözün.',
    )
  }

  const existing = await findQuickPracticeTest(supabase, topicId)
  if (existing) {
    // Havuz test satırına bağlı sorulardan okunur: konuya sonradan eklenen
    // sorular bağlanana kadar teste girmez, böylece sıra ile bağ tutarlı kalır.
    const questions = await getTestQuestions(supabase, existing.id)
    return { test: existing, questionPool: questions.map((question) => question.id) }
  }

  const examId = userExamId ?? (await getExamIdForTopic(supabase, topicId))
  const admin = createSupabaseAdminClient()
  const created = await createQuickPracticeTest(admin, {
    topicId,
    // Başlık kullanıcıya görünüyor; içerik başlığı olduğu için sözlüğe girmez.
    title: 'Hızlı Tekrar',
    examId,
    questionIds: questionPool,
  })

  return { test: created, questionPool }
}

/**
 * Ücretli içerik denetimi. Erişim kararını asıl olarak RLS ve
 * `public.has_active_subscription()` verir; burası kullanıcıya doğru hata
 * mesajını göstermek içindir (CONVENTIONS §3: yetki iki kez denetlenir).
 *
 * `config.is_free === true` olan testler ve hızlı tekrar aboneliksiz açıktır;
 * hızlı tekrar zaten kullanıcının kendi geçmişinden üretiliyor.
 */
async function assertTestAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  test: TestRow,
): Promise<void> {
  // Canlı deneme penceresi (spec §M10): pencere açılmadan önce ya da
  // kapandıktan sonra oturum AÇILAMAZ. Arayüz düğmeyi zaten gizliyor ama bir
  // Server Action herkese açık bir uç noktadır; karar burada da verilir.
  if (test.type === 'mock_exam') {
    const windowState = mockWindowState(test, new Date())
    if (!isMockStartable(windowState)) {
      throw new AppError(
        'forbidden',
        windowState === 'before'
          ? 'Bu deneme henüz başlamadı. Yayın saatinde tekrar deneyin.'
          : 'Bu denemenin katılım süresi doldu.',
      )
    }
  }

  if (test.type === 'quick_practice') return

  const config = (test.config ?? {}) as Record<string, unknown>
  if (config.is_free === true) return

  const subscribed = await hasActiveSubscription(supabase, userId)
  if (!subscribed) {
    throw new AppError(
      'subscription_required',
      'Bu testi çözmek için aktif bir aboneliğiniz olmalı.',
    )
  }
}

/**
 * Bir sorunun cevabını ANINDA kaydeder (spec §M5: sekme kapansa da cevap
 * kaybolmaz). Sunucuda puanlanır ama sonuç istemciye DÖNMEZ.
 *
 * Aynı soru yeniden cevaplanırsa ikinci satır açılmaz, mevcut satır güncellenir;
 * `repeat_index` ise ÖNCEKİ oturumlardaki çözüm sayısından gelir — aynı oturum
 * içinde şık değiştirmek "tekrar çözüm" değildir.
 */
export const submitAnswer = action(SubmitAnswerSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const session = await getSession(supabase, input.sessionId, user.id)
  if (session.finished_at !== null) {
    throw new AppError('conflict', 'Bu test tamamlanmış; cevap değiştirilemez.')
  }
  if (!isSessionResumable(session, new Date())) {
    throw new AppError('conflict', 'Bu oturumun süresi dolmuş. Testi yeniden başlatın.')
  }

  // Soru gerçekten bu oturumun sırasında mı? Değilse istemci başka bir testin
  // sorusunu bu oturuma yazdırmaya çalışıyor demektir.
  if (!session.question_order.includes(input.questionId)) {
    throw new AppError('forbidden', 'Bu soru bu teste ait değil.')
  }

  const test = await getTestById(supabase, session.test_id)

  // Puanlama service-role ile yapılır: doğru cevap sunucudan dışarı çıkmaz.
  const admin = createSupabaseAdminClient()
  const answerKey = await readAnswerKey(admin, [input.questionId])
  const answer = answerKey.get(input.questionId)
  if (!answer) throw new AppError('not_found', 'Aradığınız soru bulunamadı.')

  const isCorrect = input.selectedOption !== null && input.selectedOption === answer.correctOption

  const existing = await findSessionAttempt(supabase, {
    sessionId: session.id,
    userId: user.id,
    questionId: input.questionId,
  })

  if (existing) {
    // `attempts` öğrenci için salt-ekleme (0011); şık değiştirme service-role
    // ile yazılır. Satır kimliği kullanıcıdan değil, sahipliği doğrulanmış
    // oturumdan yapılan sorgudan geliyor.
    await updateAttempt(admin, {
      attemptId: existing.id,
      userId: user.id,
      selectedOption: input.selectedOption,
      isCorrect,
      timeSpentMs: input.timeSpentMs,
    })
  } else {
    const repeatIndex = await countPriorAttempts(supabase, {
      userId: user.id,
      questionId: input.questionId,
      excludeSessionId: session.id,
    })

    await insertAttempt(supabase, {
      userId: user.id,
      questionId: input.questionId,
      topicId: answer.topicId,
      sessionId: session.id,
      // `tests.type` ile `attempts.source` bu dört değerde birebir örtüşüyor;
      // ayrışırlarsa buraya açık bir eşleme gelmeli.
      source: test.type,
      selectedOption: input.selectedOption,
      isCorrect,
      timeSpentMs: input.timeSpentMs,
      repeatIndex,
    })
  }

  // DİKKAT: `isCorrect` bilerek dönülmüyor. Test sürerken doğruluk geri
  // bildirimi vermek, sonuç ekranını anlamsızlaştırır ve cevabı sızdırır.
  return { saved: true }
})

export type FinishTestResult = {
  sessionId: string
  /** Zaten bitmiş bir oturumu tekrar bitirmeye çalıştıysak true. */
  alreadyFinished: boolean
}

/**
 * Oturumu kapatır, özeti hesaplayıp `test_sessions.summary` içine yazar.
 *
 * FİKİRSİZDİR (idempotent): yazma `finished_at is null` koşuluyla yapılır, bu
 * yüzden iki kez bitirmek özeti iki kez saymaz. Dönen değerde puan, doğru cevap
 * ya da açıklama YOKTUR; sonuç `getResult` ile ayrıca istenir.
 */
export const finishTest = action(FinishTestSchema, async (input): Promise<FinishTestResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const session = await getSession(supabase, input.sessionId, user.id)
  if (session.finished_at !== null) {
    return { sessionId: session.id, alreadyFinished: true }
  }

  const summary = await computeSummary(supabase, user.id, session)
  const updated = await finishSession(supabase, {
    sessionId: session.id,
    userId: user.id,
    summary,
  })

  // Yetkinlik paneli, bir gönderimden en geç 2 saniye sonra güncel olmalı
  // (spec §M6); bu yüzden hesap arka plana atılmaz, burada senkron çalışır.
  // Hata yutulur: puanlama aksaklığı öğrencinin bitmiş testini kaybettirmemeli.
  const recalculated = await recalculateQuietly(
    createSupabaseAdminClient(),
    user.id,
    summary.byTopic.map((entry) => entry.topicId),
  )

  // Yanlışlardan hafıza kartı üretimi (spec §M9): ürünün çekirdek döngüsü.
  // Hata yutulur; kart üretilememesi bitmiş testi kaybettirmemeli.
  await generateCardsQuietly(createSupabaseAdminClient(), user.id, session.id)

  // Günlük aktivite (spec §M13). Süre ve soru sayısı SUNUCUNUN hesapladığı
  // özetten gelir; istemciden gelen hiçbir sayı kullanılmaz. `updated === 0`
  // ise damgayı başka bir çağrı attı, sayaç ikinci kez artmaz.
  if (updated > 0) {
    await recordStudyActivityQuietly(createSupabaseAdminClient(), user.id, {
      seconds: Math.round(summary.totalTimeMs / 1000),
      questions: summary.correct + summary.wrong,
    })

    // Rozet değerlendirmesi (spec §M13). Zayıf→güçlü geçişi yalnızca BU anda
    // bilinir — `mastery_history` haftalık yazıldığı için sonradan türetilmesi
    // garanti değil; bu yüzden sayı buradan taşınır. Değerlendirme sessizdir:
    // bir rozet hatası bitmiş testi kaybettirmemeli.
    await evaluateAndAwardBadgesQuietly(createSupabaseAdminClient(), user.id, {
      weakToStrongNow: recalculated.filter((entry) => entry.becameStrong).length,
    })
  }

  // Yetkinlik paneli ve program bir gönderimden sonra taze olmalı (spec §M6):
  // yönlendirmede istemci yönlendirici önbelleğinden eski sayfa gelmesin.
  revalidatePath('/dersler', 'layout')
  revalidatePath('/panel')
  revalidatePath('/dashboard')
  revalidatePath('/program')
  return { sessionId: session.id, alreadyFinished: updated === 0 }
})

/** Oturumun özetini soru sırası + kaydedilmiş cevaplardan hesaplar. */
async function computeSummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  session: TestSessionRow,
): Promise<TestSummary> {
  const test = await getTestById(supabase, session.test_id)
  const questions = await getTestQuestions(supabase, session.test_id)
  const attempts = await getSessionAttempts(supabase, session.id, userId)

  // Yalnızca bu oturumun sırasındaki sorular sayılır: testte olup oturuma
  // girmemiş sorular (hızlı tekrarda havuzun geri kalanı) özete karışmaz.
  const inOrder = new Set(session.question_order)
  const scoped = orderedQuestions(questions, session.question_order).filter((question) =>
    inOrder.has(question.id),
  )

  const divisor = await getWrongPenaltyDivisor(supabase, test.exam_id)

  const summaryAttempts: SummaryAttempt[] = attempts.map((attempt) => ({
    questionId: attempt.question_id,
    selectedOption: attempt.selected_option,
    isCorrect: attempt.is_correct,
    timeSpentMs: attempt.time_spent_ms,
  }))

  return summarise(
    scoped.map((question) => ({ questionId: question.id, topicId: question.topicId })),
    summaryAttempts,
    divisor,
  )
}

/** Soruları oturumun karıştırılmış sırasına dizer. */
function orderedQuestions(questions: PublicQuestion[], order: string[]): PublicQuestion[] {
  const byId = new Map(questions.map((question) => [question.id, question]))
  return order.flatMap((id) => {
    const question = byId.get(id)
    return question ? [question] : []
  })
}

export type ResultQuestion = {
  questionId: string
  topicId: string
  stem: string
  options: Array<{ key: string; text: string }>
  imageUrl: string | null
  /** Öğrencinin işaretlediği şık; null = boş bıraktı. */
  selectedOption: string | null
  correctOption: string
  isCorrect: boolean
  explanation: string | null
  solutionVideoUrl: string | null
  timeSpentMs: number
  bookmarked: boolean
}

export type TestResult = {
  sessionId: string
  testId: string
  testTitle: string
  finishedAt: string
  summary: TestSummary
  questions: ResultQuestion[]
}

/**
 * Sonuç ekranının verisi — doğru şık, açıklama ve çözüm videosu BURADA açılır.
 *
 * Oturum bitmemişse `forbidden` ile reddedilir. Bu denetim olmasaydı kullanıcı
 * testi başlatıp hiçbir soruyu cevaplamadan bütün cevap anahtarını okuyabilirdi.
 */
export const getResult = action(GetResultSchema, async (input): Promise<TestResult> => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  const session = await getSession(supabase, input.sessionId, user.id)
  // Tek kapı: cevap anahtarının açılıp açılmayacağına saf bir yüklem karar
  // verir (bkz. lib/test-engine/session.ts → canRevealAnswers) ve o yüklem
  // birim testleriyle kilitlenmiştir.
  if (!canRevealAnswers(session)) {
    throw new AppError('forbidden', 'Sonuçları görmek için önce testi bitirmelisiniz.')
  }

  const test = await getTestById(supabase, session.test_id)
  const questions = orderedQuestions(
    await getTestQuestions(supabase, session.test_id),
    session.question_order,
  )
  const attempts = await getSessionAttempts(supabase, session.id, user.id)
  const attemptByQuestion = new Map(attempts.map((attempt) => [attempt.question_id, attempt]))

  // Oturum bittiği doğrulandıktan SONRA cevap anahtarı okunur.
  const answerKey = await readAnswerKey(
    createSupabaseAdminClient(),
    questions.map((question) => question.id),
  )

  const bookmarked = await getBookmarkedQuestionIds(
    supabase,
    user.id,
    questions.map((question) => question.id),
  )

  const resultQuestions: ResultQuestion[] = questions.map((question) => {
    const attempt = attemptByQuestion.get(question.id)
    const answer = answerKey.get(question.id)
    const selectedOption = attempt?.selected_option ?? null
    return {
      questionId: question.id,
      topicId: question.topicId,
      stem: question.stem,
      options: question.options,
      imageUrl: question.imageUrl,
      selectedOption,
      correctOption: answer?.correctOption ?? '',
      isCorrect: attempt?.is_correct ?? false,
      explanation: answer?.explanation ?? null,
      solutionVideoUrl: answer?.solutionVideoUrl ?? null,
      timeSpentMs: attempt?.time_spent_ms ?? 0,
      bookmarked: bookmarked.has(question.id),
    }
  })

  // Özet bitişte yazıldı; bir sebeple yoksa aynı girdiden yeniden hesaplanır.
  const summary =
    (session.summary as TestSummary | null) ?? (await computeSummary(supabase, user.id, session))

  return {
    sessionId: session.id,
    testId: test.id,
    testTitle: test.title,
    finishedAt: session.finished_at,
    summary,
    questions: resultQuestions,
  }
})

/**
 * Yanlış soru defterine ekler (ya da notunu günceller).
 * Not opsiyoneldir; aynı soru ikinci kez eklenirse yeni satır açılmaz.
 */
export const bookmarkQuestion = action(BookmarkQuestionSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  await upsertBookmark(supabase, {
    userId: user.id,
    questionId: input.questionId,
    note: input.note && input.note.length > 0 ? input.note : null,
  })

  revalidatePath('/soru-defteri')
  return { bookmarked: true }
})

/** Yanlış soru defterinden çıkarır. */
export const removeBookmark = action(RemoveBookmarkSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  await deleteBookmark(supabase, { userId: user.id, questionId: input.questionId })

  revalidatePath('/soru-defteri')
  return { bookmarked: false }
})
