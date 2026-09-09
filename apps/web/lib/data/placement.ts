import 'server-only'

import type { Tables } from '@zihin/db/types'
import { AppError } from '@/lib/errors'
import type { PlacementSubjectLike } from '@/lib/placement/select'
import type { DataClient } from './client'

/**
 * Seviye tespit sınavının okuma/yazma katmanı (spec §M7).
 *
 * GÜVENLİK: soru havuzu `questions_public` görünümünden okunur; `questions`
 * tablosuna dokunulmaz (cevap kolonları `authenticated` rolünden geri
 * alınmıştır). Buradaki hiçbir fonksiyon doğru cevabı görmez.
 *
 * Sorgular düzdür (CONVENTIONS §5): üretilen tipler ilişki taşımadığı için
 * ders → ünite → konu → soru zinciri dört ayrı sorguyla yürütülür.
 */

type Client = DataClient

export type PlacementCandidates = {
  /** Sınavın dersleri, müfredat sırasında; ağırlık konulardan toplanır. */
  subjects: PlacementSubjectLike[]
  /** Ders kimliği → yayımlanmış soru kimlikleri. */
  questionsBySubject: Record<string, string[]>
}

/**
 * Havuz taramasının üst sınırı.
 *
 * Seviye tespitine en çok 30 soru girecek; havuzun tamamını okumanın tek
 * amacı derse göre dağıtım yapabilmek. Sınırsız bir `select` büyük bir
 * müfredatta on binlerce satır çeker, o yüzden tarama kimliğe göre sıralı ve
 * sabit tavanlıdır. Tavan dolduğunda seçim yine geçerlidir — yalnızca havuzun
 * bir bölümünden yapılmış olur.
 */
const QUESTION_SCAN_LIMIT = 5000

/**
 * Seviye tespit sınavının aday havuzunu getirir.
 *
 * Bir dersin ağırlığı, konularının `exam_weight` toplamıdır: `exam_weight`
 * konu düzeyinde tutulan tek ağırlık kolonu ve toplamı "bu dersten sınavda ne
 * kadar soru çıkar" sorusunun en iyi yaklaşımı. `subjects.question_count`
 * bilerek kullanılmadı; opsiyonel (null olabilir) ve içerik ekibi tarafından
 * her sınav için doldurulmuş olmayabilir.
 */
export async function getPlacementCandidates(
  client: Client,
  examId: string,
): Promise<PlacementCandidates> {
  const { data: subjectRows, error: subjectError } = await client
    .from('subjects')
    .select('id, order_index')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (subjectError) throw new AppError('internal', 'Sınav dersleri yüklenemedi.')
  const subjects = subjectRows ?? []
  if (subjects.length === 0) return { subjects: [], questionsBySubject: {} }

  const subjectIds = subjects.map((row) => row.id)

  const { data: unitRows, error: unitError } = await client
    .from('units')
    .select('id, subject_id')
    .in('subject_id', subjectIds)
    .is('deleted_at', null)

  if (unitError) throw new AppError('internal', 'Sınav üniteleri yüklenemedi.')
  const units = unitRows ?? []
  if (units.length === 0) return { subjects: [], questionsBySubject: {} }

  const subjectOfUnit = new Map(units.map((unit) => [unit.id, unit.subject_id]))

  const { data: topicRows, error: topicError } = await client
    .from('topics')
    .select('id, unit_id, exam_weight')
    .in('unit_id', [...subjectOfUnit.keys()])
    .is('deleted_at', null)

  if (topicError) throw new AppError('internal', 'Sınav konuları yüklenemedi.')
  const topics = topicRows ?? []
  if (topics.length === 0) return { subjects: [], questionsBySubject: {} }

  const subjectOfTopic = new Map<string, string>()
  const weightBySubject = new Map<string, number>()
  for (const topic of topics) {
    const subjectId = subjectOfUnit.get(topic.unit_id)
    if (subjectId === undefined) continue
    subjectOfTopic.set(topic.id, subjectId)
    // `exam_weight` numeric(3,2); PostgREST bunu metin olarak dönebilir.
    const weight = Number(topic.exam_weight)
    weightBySubject.set(
      subjectId,
      (weightBySubject.get(subjectId) ?? 0) + (Number.isFinite(weight) ? weight : 0),
    )
  }

  const { data: questionRows, error: questionError } = await client
    .from('questions_public')
    .select('id, topic_id')
    .in('topic_id', [...subjectOfTopic.keys()])
    .eq('is_published', true)
    .order('id', { ascending: true })
    .limit(QUESTION_SCAN_LIMIT)

  if (questionError) throw new AppError('internal', 'Sınav soruları yüklenemedi.')

  const questionsBySubject: Record<string, string[]> = {}
  for (const question of questionRows ?? []) {
    if (!question.id || !question.topic_id) continue
    const subjectId = subjectOfTopic.get(question.topic_id)
    if (subjectId === undefined) continue
    ;(questionsBySubject[subjectId] ??= []).push(question.id)
  }

  return {
    subjects: subjects.map((row) => ({
      subjectId: row.id,
      examWeight: weightBySubject.get(row.id) ?? 0,
    })),
    questionsBySubject,
  }
}

/**
 * Kullanıcının bu sınav için seviye tespit test satırını oluşturur.
 *
 * KARAR: hızlı tekrarın aksine (konu başına tek satır) seviye tespitte her
 * başlatma KENDİ `tests` satırını açar. Sebep: soru seçimi kullanıcıya özeldir
 * ve çözme ekranı soruları `test_questions` üzerinden okur — ortak bir satır
 * bütün havuzu bağlamak zorunda kalırdı. Satır sayısı sınırlıdır: aynı
 * kullanıcı için yarım kalan bir oturum varsa yenisi açılmaz (bkz.
 * `findResumablePlacementSession`), yani öğrenci başına birkaç satır olur.
 *
 * Tür `unit_test`: `tests_type_check` yalnızca dört değere izin veriyor ve
 * seviye tespiti tek bir konuya bağlı olmayan, birden çok üniteyi kapsayan bir
 * ölçüm. Sınavın "seviye tespit" olduğu iki yerden okunur:
 * `config.generated = 'placement'` ve `test_sessions.is_placement`.
 */
export async function createPlacementTest(
  adminClient: Client,
  input: { examId: string; userId: string; title: string; questionIds: string[] },
): Promise<Tables<'tests'>> {
  const { data, error } = await adminClient
    .from('tests')
    .insert({
      type: 'unit_test',
      title: input.title,
      exam_id: input.examId,
      duration_seconds: 1800,
      is_published: true,
      // `is_free`: seviye tespit abonelik istemez — öğrenci daha satın alma
      // ekranını görmeden çözer (spec §M7).
      config: { generated: 'placement', is_free: true, user_id: input.userId },
    })
    .select('*')
    .single()

  if (error || !data) throw new AppError('internal', 'Seviye tespit sınavı oluşturulamadı.')

  if (input.questionIds.length > 0) {
    const { error: linkError } = await adminClient.from('test_questions').insert(
      input.questionIds.map((questionId, index) => ({
        test_id: data.id,
        question_id: questionId,
        order_index: index,
      })),
    )
    if (linkError) throw new AppError('internal', 'Seviye tespit sınavı oluşturulamadı.')
  }

  return data
}

/** Yarım kalmış, süresi dolmamış seviye tespit oturumu (varsa). */
export async function findResumablePlacementSession(
  client: Client,
  userId: string,
  now: Date = new Date(),
): Promise<Tables<'test_sessions'> | null> {
  const { data, error } = await client
    .from('test_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_placement', true)
    .is('finished_at', null)
    .gt('expires_at', now.toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Seviye tespit oturumu okunamadı.')
  return data ?? null
}

export type PlacementStatus = {
  /** Tamamlanmış bir seviye tespit oturumu var mı? */
  completed: boolean
  /** Tamamlandıysa oturumun kimliği — sonuç ekranına bağlantı için. */
  completedSessionId: string | null
  completedAt: string | null
  /** Yarım kalmış oturumun kimliği; "kaldığın yerden devam et" için. */
  resumableSessionId: string | null
}

/**
 * Panelin ihtiyaç duyduğu tek soru: bu öğrenci seviye tespitini yaptı mı?
 * Tek sorgu; en son iki oturuma bakmak yerine biten ve devam eden ayrı ayrı
 * aranmaz — satır sayısı öğrenci başına birkaç tane.
 */
export async function getPlacementStatus(
  client: Client,
  userId: string,
  now: Date = new Date(),
): Promise<PlacementStatus> {
  const { data, error } = await client
    .from('test_sessions')
    .select('id, finished_at, expires_at, started_at')
    .eq('user_id', userId)
    .eq('is_placement', true)
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) throw new AppError('internal', 'Seviye tespit durumu okunamadı.')

  const rows = data ?? []
  const finished = rows.find((row) => row.finished_at !== null)
  const resumable = rows.find(
    (row) => row.finished_at === null && new Date(row.expires_at).getTime() > now.getTime(),
  )

  return {
    completed: finished !== undefined,
    completedSessionId: finished?.id ?? null,
    completedAt: finished?.finished_at ?? null,
    resumableSessionId: resumable?.id ?? null,
  }
}
