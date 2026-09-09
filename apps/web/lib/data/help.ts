import 'server-only'

import type { Tables } from '@zihin/db/types'
import { AppError } from '@/lib/errors'
import { parseOptions, type QuestionOption } from '@/lib/questions/options'
import { bestDailyQuestionLimit, type TurkeyDayWindow } from '@/lib/help/limits'
import { HELP_UPLOADS_BUCKET } from '@/lib/help/storage'
import type { DataClient } from './client'

/**
 * Soru Çözücü'nün (spec §M11) okuma katmanı.
 *
 * GÜVENLİK KURALI (CONVENTIONS): burada `public.questions` OKUNMAZ. Benzer soru
 * araması `public.search_similar_questions` fonksiyonuna gider; o fonksiyon
 * `questions_public` görünümünü okur ve `security invoker` olduğu için çağıran
 * öğrencinin RLS'i geçerlidir. Doğru cevap ve açıklama hiçbir yoldan buraya
 * gelmez.
 *
 * Sorgular düz tutulur (iç içe select yok): üretilen tipler ilişki taşımıyor
 * (CONVENTIONS §5).
 */

type Client = DataClient

export type HelpRequestRow = Tables<'help_requests'>
export type HelpMessageRow = Tables<'help_messages'>
export type HelpRequestStatus = HelpRequestRow['status']

/* ------------------------------------------------------------------------- *
 * Günlük kota
 * ------------------------------------------------------------------------- */

/**
 * Öğrencinin günlük soru hakkı.
 *
 * Aktif aboneliğin paketindeki `features.daily_question_limit` geçerlidir;
 * abonelik yoksa varsayılan (3) kullanılır. Birden fazla aktif abonelik varsa
 * en cömert limit uygulanır (bkz. lib/help/limits.ts).
 */
export async function getDailyQuestionLimit(
  client: Client,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const { data: subscriptions, error } = await client
    .from('subscriptions')
    .select('package_id, ends_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('ends_at', now.toISOString())

  if (error) throw new AppError('internal', 'Abonelik bilgisi okunamadı.')

  const packageIds = [...new Set((subscriptions ?? []).map((row) => row.package_id))]
  if (packageIds.length === 0) return bestDailyQuestionLimit([])

  const { data: packages, error: packageError } = await client
    .from('packages')
    .select('id, features')
    .in('id', packageIds)

  if (packageError) throw new AppError('internal', 'Paket bilgisi okunamadı.')

  return bestDailyQuestionLimit((packages ?? []).map((row) => row.features))
}

/**
 * Verilen Türkiye günü içinde açılan soru sayısı.
 *
 * Aralık `[startIso, endIso)`: gün sınırı `public.tr_today()` ile aynı yerden
 * geçer, böylece kota gece yarısında sistemin geri kalanıyla aynı anda sıfırlanır.
 */
export async function countRequestsInWindow(
  client: Client,
  userId: string,
  window: TurkeyDayWindow,
): Promise<number> {
  const { count, error } = await client
    .from('help_requests')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', userId)
    .gte('created_at', window.startIso)
    .lt('created_at', window.endIso)

  if (error) throw new AppError('internal', 'Günlük soru sayınız okunamadı.')
  return count ?? 0
}

/* ------------------------------------------------------------------------- *
 * Sorular
 * ------------------------------------------------------------------------- */

/** Öğrencinin soru geçmişi, yeniden eskiye. */
export async function listStudentRequests(
  client: Client,
  userId: string,
  limit = 50,
): Promise<HelpRequestRow[]> {
  const { data, error } = await client
    .from('help_requests')
    .select('*')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new AppError('internal', 'Sorularınız yüklenemedi.')
  return data ?? []
}

/**
 * Tek bir soru. RLS okumayı zaten sınırlar (öğrencinin kendisi ya da herhangi
 * bir öğretmen); çağıran taraf ayrıca kendi yetkisini denetler.
 */
export async function getHelpRequest(client: Client, requestId: string): Promise<HelpRequestRow> {
  const { data, error } = await client
    .from('help_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Soru yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Aradığınız soru bulunamadı.')
  return data
}

/** Bir sorunun yazışması, eskiden yeniye. */
export async function listHelpMessages(
  client: Client,
  requestId: string,
): Promise<HelpMessageRow[]> {
  const { data, error } = await client
    .from('help_messages')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })

  if (error) throw new AppError('internal', 'Yazışma yüklenemedi.')
  return data ?? []
}

/** Bir sorudaki mesaj sayısı — composer'ı kapatmak için (5 mesaj sınırı, 0007). */
export async function countHelpMessages(client: Client, requestId: string): Promise<number> {
  const { count, error } = await client
    .from('help_messages')
    .select('id', { count: 'exact', head: true })
    .eq('request_id', requestId)

  if (error) throw new AppError('internal', 'Yazışma sayısı okunamadı.')
  return count ?? 0
}

/**
 * Öğretmen kuyruğu: yalnızca açık sorular, EN ESKİDEN yeniye (bekleyen öğrenci
 * önce). `idx_help_requests_status_created_at` tam bu sorgu için kısmi indeks.
 */
export async function listQueueRequests(
  client: Client,
  options: { status?: HelpRequestStatus; subjectId?: string | null; limit?: number } = {},
): Promise<HelpRequestRow[]> {
  let query = client
    .from('help_requests')
    .select('*')
    .eq('status', options.status ?? 'open')

  if (options.subjectId) query = query.eq('subject_id', options.subjectId)

  const { data, error } = await query
    .order('created_at', { ascending: true })
    .limit(options.limit ?? 100)

  if (error) throw new AppError('internal', 'Soru kuyruğu yüklenemedi.')
  return data ?? []
}

/** Bir öğretmenin yanıtladığı son sorular (kendi geçmişi). */
export async function listAnsweredByTeacher(
  client: Client,
  teacherId: string,
  limit = 20,
): Promise<HelpRequestRow[]> {
  const { data, error } = await client
    .from('help_requests')
    .select('*')
    .eq('assigned_teacher_id', teacherId)
    .order('answered_at', { ascending: false })
    .limit(limit)

  if (error) throw new AppError('internal', 'Yanıtladığınız sorular yüklenemedi.')
  return data ?? []
}

/* ------------------------------------------------------------------------- *
 * Benzer soru araması
 * ------------------------------------------------------------------------- */

export type SimilarQuestion = {
  id: string
  topicId: string
  stem: string
  options: QuestionOption[]
  imageUrl: string | null
  difficulty: number
  similarity: number
}

/** Fonksiyonun döndürdüğü ham satır. */
type SimilarQuestionRow = {
  id: string
  topic_id: string
  stem: string
  options: unknown
  image_url: string | null
  difficulty: number
  similarity: number
}

/**
 * `public.search_similar_questions` çağrısı (0014_help_search.sql).
 *
 * TİP NOTU: `packages/db/src/types.ts` üretilmiş bir dosya ve şu an fonksiyon
 * imzalarını `Args: Record<string, unknown>` olarak taşıyor; `rpc()` jenerikleri
 * bu adı tanımıyor. Dönüşüm burada, TEK noktada ve dar bir arayüzle yapılır —
 * çağıran taraflar tipli `SimilarQuestion` görür. Tipler yeniden üretildiğinde
 * bu dönüşüm sadeleşebilir.
 */
export async function searchSimilarQuestions(
  client: Client,
  input: { query: string; topicId?: string | null; limit?: number },
): Promise<SimilarQuestion[]> {
  const rpc = client as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: SimilarQuestionRow[] | null; error: { message: string } | null }>
  }

  const { data, error } = await rpc.rpc('search_similar_questions', {
    query: input.query,
    target_topic: input.topicId ?? null,
    max_results: input.limit ?? 3,
  })

  if (error) {
    // Benzer soru araması bir KOLAYLIK: başarısız olursa öğrencinin sorusu
    // yine de öğretmene gidebilmeli, akış hata ekranına düşmemeli.
    console.error('[help] benzer soru araması başarısız:', error)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    stem: row.stem,
    options: parseOptions(row.options),
    imageUrl: row.image_url,
    difficulty: row.difficulty,
    similarity: row.similarity,
  }))
}

/** Kimlikleri verilen soruların güvenli hâli (eşleşen soruları göstermek için). */
export async function getPublicQuestionsByIds(
  client: Client,
  ids: readonly string[],
): Promise<SimilarQuestion[]> {
  if (ids.length === 0) return []

  const { data, error } = await client
    .from('questions_public')
    .select('id, topic_id, stem, options, image_url, difficulty')
    .in('id', [...ids])

  if (error) throw new AppError('internal', 'Benzer sorular yüklenemedi.')

  return (data ?? []).map((row) => ({
    id: row.id ?? '',
    topicId: row.topic_id ?? '',
    stem: row.stem ?? '',
    options: parseOptions(row.options),
    imageUrl: row.image_url,
    difficulty: row.difficulty ?? 3,
    similarity: 1,
  }))
}

/* ------------------------------------------------------------------------- *
 * Müfredat etiketleri
 * ------------------------------------------------------------------------- */

export type SubjectOption = { id: string; name: string }
export type TopicOption = { id: string; title: string; subjectId: string; unitName: string }

/** Sınavın dersleri (form seçicisi). */
export async function getHelpSubjects(client: Client, examId: string): Promise<SubjectOption[]> {
  const { data, error } = await client
    .from('subjects')
    .select('id, name, order_index')
    .eq('exam_id', examId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Dersler yüklenemedi.')
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }))
}

/**
 * Sınavın bütün konuları, dersine bağlı olarak. Form konu seçicisi seçilen
 * derse göre süzüldüğü için hepsi bir kerede alınır — iki düz sorgu.
 */
export async function getHelpTopics(client: Client, examId: string): Promise<TopicOption[]> {
  const { data: subjects, error: subjectError } = await client
    .from('subjects')
    .select('id')
    .eq('exam_id', examId)
    .is('deleted_at', null)

  if (subjectError) throw new AppError('internal', 'Dersler yüklenemedi.')
  const subjectIds = (subjects ?? []).map((row) => row.id)
  if (subjectIds.length === 0) return []

  const { data: units, error: unitError } = await client
    .from('units')
    .select('id, subject_id, name, order_index')
    .in('subject_id', subjectIds)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (unitError) throw new AppError('internal', 'Üniteler yüklenemedi.')
  const unitRows = units ?? []
  if (unitRows.length === 0) return []

  const { data: topics, error: topicError } = await client
    .from('topics')
    .select('id, unit_id, title, order_index')
    .in(
      'unit_id',
      unitRows.map((row) => row.id),
    )
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (topicError) throw new AppError('internal', 'Konular yüklenemedi.')

  const unitById = new Map(unitRows.map((row) => [row.id, row]))

  return (topics ?? []).flatMap((topic) => {
    const unit = unitById.get(topic.unit_id)
    if (!unit) return []
    return [{ id: topic.id, title: topic.title, subjectId: unit.subject_id, unitName: unit.name }]
  })
}

/** Kimliği verilen derslerin adları (liste etiketleri). */
export async function getSubjectNames(
  client: Client,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()

  const { data, error } = await client.from('subjects').select('id, name').in('id', unique)
  if (error) throw new AppError('internal', 'Ders adları yüklenemedi.')
  return new Map((data ?? []).map((row) => [row.id, row.name]))
}

/** Kimliği verilen konuların başlıkları. */
export async function getTopicTitles(
  client: Client,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()

  const { data, error } = await client.from('topics').select('id, title').in('id', unique)
  if (error) throw new AppError('internal', 'Konu başlıkları yüklenemedi.')
  return new Map((data ?? []).map((row) => [row.id, row.title]))
}

/** Bir konunun bağlı olduğu ders — form girdisinin tutarlılığı burada doğrulanır. */
export async function getSubjectIdForTopic(
  client: Client,
  topicId: string,
): Promise<string | null> {
  const { data: topic, error } = await client
    .from('topics')
    .select('unit_id')
    .eq('id', topicId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Konu yüklenemedi.')
  if (!topic) return null

  const { data: unit, error: unitError } = await client
    .from('units')
    .select('subject_id')
    .eq('id', topic.unit_id)
    .maybeSingle()

  if (unitError) throw new AppError('internal', 'Ünite yüklenemedi.')
  return unit?.subject_id ?? null
}

/* ------------------------------------------------------------------------- *
 * Kişiler ve dosyalar
 * ------------------------------------------------------------------------- */

export type PersonLabel = { id: string; displayName: string }

/**
 * Kuyruktaki soruların sahiplerinin GÖRÜNEN adı.
 *
 * SERVICE-ROLE gerekçesi: öğretmen kuyruktaki bütün açık soruları görür
 * (0011), ama `profiles` okuması yalnızca ATANMIŞ öğrenciye açıktır. Atanmamış
 * bir öğrencinin sorusunda ad boş kalırdı. Bu yüzden yalnızca `display_name`
 * kolonu, yalnızca sunucunun kendi sorgusundan gelen kimlikler için okunur —
 * tam ad, e-posta ya da başka bir alan ASLA okunmaz (CONVENTIONS §4).
 */
export async function getDisplayNames(
  admin: Client,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()

  const { data, error } = await admin.from('profiles').select('id, display_name').in('id', unique)

  if (error) throw new AppError('internal', 'Öğrenci bilgileri yüklenemedi.')
  return new Map((data ?? []).map((row) => [row.id, row.display_name ?? '']))
}

/** Öğretmene atanmış öğrencilerin kimlikleri. */
export async function getAssignedStudentIds(client: Client, teacherId: string): Promise<string[]> {
  const { data, error } = await client
    .from('teacher_assignments')
    .select('student_id')
    .eq('teacher_id', teacherId)

  if (error) throw new AppError('internal', 'Öğrenci listesi yüklenemedi.')
  return (data ?? []).map((row) => row.student_id)
}

export type AssignedStudent = {
  id: string
  displayName: string
  grade: string | null
  examId: string | null
  xp: number
  level: number
  currentStreak: number
}

/**
 * Öğretmenin öğrencileri. `profiles` okuması RLS ile zaten atamaya bağlı
 * (`can_read_student_data`), bu yüzden oturum istemcisiyle okunur.
 */
export async function getAssignedStudents(
  client: Client,
  teacherId: string,
): Promise<AssignedStudent[]> {
  const ids = await getAssignedStudentIds(client, teacherId)
  if (ids.length === 0) return []

  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, full_name, grade, exam_id, xp, level, current_streak')
    .in('id', ids)

  if (error) throw new AppError('internal', 'Öğrenci listesi yüklenemedi.')

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      // Takma ad varsa o kullanılır; yoksa tam ad. Öğretmen kendi öğrencisinin
      // adını görmeye zaten yetkili (atama var).
      displayName: row.display_name?.trim() || row.full_name?.trim() || 'Öğrenci',
      grade: row.grade,
      examId: row.exam_id,
      xp: row.xp ?? 0,
      level: row.level ?? 1,
      currentStreak: row.current_streak ?? 0,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'))
}

/**
 * `help-uploads` özel bir kovadır: görsel ancak süreli imzalı URL ile
 * gösterilir. İmzalama service-role ile yapılır; anahtar her zaman
 * veritabanındaki satırdan gelir, istemciden değil.
 */
export async function createSignedHelpImageUrl(
  admin: Client,
  key: string | null,
  ttlSeconds = 60 * 60,
): Promise<string | null> {
  if (!key) return null
  // Öğretmen yanıtındaki görsel dış bir adres olabilir (kova anahtarı değil);
  // imzalanacak bir şey yok, olduğu gibi geçer.
  if (/^https?:\/\//i.test(key)) return key

  const { data, error } = await admin.storage
    .from(HELP_UPLOADS_BUCKET)
    .createSignedUrl(key, ttlSeconds)

  if (error || !data) {
    console.error('[help] görsel imzalanamadı:', error)
    return null
  }
  return data.signedUrl
}

/* ------------------------------------------------------------------------- *
 * Öğretmenin öğrenci özeti
 * ------------------------------------------------------------------------- */

export type StudentMasterySummary = {
  userId: string
  /** Ölçülmüş konuların yetkinlik ortalaması (0-100); ölçüm yoksa null. */
  averageMastery: number | null
  measuredTopics: number
  weakTopics: number
}

/**
 * Atanmış öğrencilerin yetkinlik özeti — SALT OKUNUR.
 *
 * `topic_mastery` okuması RLS'te `can_read_student_data()` ile atanmış
 * öğretmene açık (0011); yazma yolu bu modülde YOKTUR ve olmamalı. Öğretmen
 * yanıtlar, öğrencinin ilerlemesini elle değiştirmez.
 *
 * `status = 'unknown'` satırları ortalamaya katılmaz: yeterli veri olmayan
 * konu bir "puan" değildir (bkz. packages/core → classifyMastery).
 */
export async function getMasterySummaries(
  client: Client,
  userIds: readonly string[],
): Promise<Map<string, StudentMasterySummary>> {
  const summaries = new Map<string, StudentMasterySummary>()
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return summaries

  const { data, error } = await client
    .from('topic_mastery')
    .select('user_id, mastery, status')
    .in('user_id', ids)

  if (error) throw new AppError('internal', 'Yetkinlik özeti yüklenemedi.')

  const totals = new Map<string, { sum: number; count: number; weak: number }>()
  for (const row of data ?? []) {
    if (row.status === 'unknown') continue
    const entry = totals.get(row.user_id) ?? { sum: 0, count: 0, weak: 0 }
    entry.sum += row.mastery
    entry.count += 1
    if (row.status === 'weak') entry.weak += 1
    totals.set(row.user_id, entry)
  }

  for (const userId of ids) {
    const entry = totals.get(userId)
    summaries.set(userId, {
      userId,
      averageMastery: entry && entry.count > 0 ? Math.round(entry.sum / entry.count) : null,
      measuredTopics: entry?.count ?? 0,
      weakTopics: entry?.weak ?? 0,
    })
  }

  return summaries
}
