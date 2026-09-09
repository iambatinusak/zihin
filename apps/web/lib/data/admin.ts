import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { Role } from '@/lib/roles'
import { AppError } from '@/lib/errors'
import type { DataClient } from './client'

/**
 * Yönetim panelinin okuma katmanı (spec §M15).
 *
 * Sorguların tamamı DÜZ: üretilen tiplerde `Relationships: []` olduğu için
 * iç içe `select` `never` çözülür (CONVENTIONS). Ağaç burada, uygulama
 * tarafında birleştirilir.
 *
 * İSTEMCİ SEÇİMİ: buradaki fonksiyonların çoğu normal oturum istemcisiyle
 * çalışır, çünkü 0011'deki politikalar zaten yönetime izin veriyor —
 * içerik tabloları `is_editor()`, `profiles` / `payments` / `job_runs`
 * `is_admin()`. Tek istisna e-posta: `auth.users` PostgREST'e açık değildir,
 * bu yüzden `getEmailIndex()` service-role GoTrue yönetim API'sini kullanır.
 */

type Client = DataClient

/* ────────────────────────────── Müfredat ağacı ───────────────────────────── */

export type CurriculumTopic = Tables<'topics'>
export type CurriculumUnit = Tables<'units'> & { topics: CurriculumTopic[] }
export type CurriculumSubject = Tables<'subjects'> & { units: CurriculumUnit[] }
export type CurriculumExam = Tables<'exams'> & { subjects: CurriculumSubject[] }

/**
 * Tüm müfredat ağacı: sınav → ders → ünite → konu.
 *
 * Dört düz sorgu; her düzey `order_index` ile sıralı gelir, böylece sürükle
 * bırak listesinin başlangıç sırası sunucudan doğru gelir. Yumuşak silinmiş
 * satırlar dışarıda kalır — silinen düğüm ağaçta görünmez.
 *
 * `is_active = false` sınavlar DIŞARIDA BIRAKILMAZ: yayından kalkmış bir
 * sınavın müfredatı hâlâ düzenlenebilir olmalı, aksi hâlde içerik erişilemez
 * hâle gelir.
 */
export async function getCurriculumTree(client: Client): Promise<CurriculumExam[]> {
  const { data: examRows, error: examError } = await client
    .from('exams')
    .select('*')
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (examError) throw new AppError('internal', 'Sınavlar yüklenemedi.')
  const exams = examRows ?? []
  if (exams.length === 0) return []

  const { data: subjectRows, error: subjectError } = await client
    .from('subjects')
    .select('*')
    .in(
      'exam_id',
      exams.map((exam) => exam.id),
    )
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (subjectError) throw new AppError('internal', 'Dersler yüklenemedi.')
  const subjects = subjectRows ?? []

  const units = await listUnits(
    client,
    subjects.map((subject) => subject.id),
  )
  const topics = await listTopics(
    client,
    units.map((unit) => unit.id),
  )

  const topicsByUnit = groupBy(topics, (topic) => topic.unit_id)
  const unitsBySubject = groupBy(units, (unit) => unit.subject_id)
  const subjectsByExam = groupBy(subjects, (subject) => subject.exam_id)

  return exams.map((exam) => ({
    ...exam,
    subjects: (subjectsByExam.get(exam.id) ?? []).map((subject) => ({
      ...subject,
      units: (unitsBySubject.get(subject.id) ?? []).map((unit) => ({
        ...unit,
        topics: topicsByUnit.get(unit.id) ?? [],
      })),
    })),
  }))
}

async function listUnits(
  client: Client,
  subjectIds: readonly string[],
): Promise<Tables<'units'>[]> {
  if (subjectIds.length === 0) return []
  const { data, error } = await client
    .from('units')
    .select('*')
    .in('subject_id', [...subjectIds])
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Üniteler yüklenemedi.')
  return data ?? []
}

async function listTopics(client: Client, unitIds: readonly string[]): Promise<Tables<'topics'>[]> {
  if (unitIds.length === 0) return []
  const { data, error } = await client
    .from('topics')
    .select('*')
    .in('unit_id', [...unitIds])
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  if (error) throw new AppError('internal', 'Konular yüklenemedi.')
  return data ?? []
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const bucket = map.get(key(item))
    if (bucket) bucket.push(item)
    else map.set(key(item), [item])
  }
  return map
}

/* ──────────────────────────── Silme etkisi ──────────────────────────────── */

export type CurriculumLevel = 'exam' | 'subject' | 'unit' | 'topic'

/**
 * Yumuşak silmenin GİZLEYECEĞİ içerik. Onay kutusu bu sayıları gösterir.
 * Alt satırlar silinmez — üst düğüm gizlendiği için erişilemez hâle gelirler.
 */
export type DeleteImpact = {
  subjectCount: number
  unitCount: number
  topicCount: number
  videoCount: number
  questionCount: number
  flashcardCount: number
}

/**
 * Bir düğümü silmenin etkisi. Önce alt düğüm kimlikleri toplanır, sonra üç
 * sayım sorgusu (`head: true`) atılır — satırlar çekilmez, yalnızca sayılır.
 */
export async function getDeleteImpact(
  client: Client,
  level: CurriculumLevel,
  id: string,
): Promise<DeleteImpact> {
  const subjectIds =
    level === 'subject'
      ? [id]
      : level === 'exam'
        ? await childIds(client, 'subjects', 'exam_id', [id])
        : []

  const unitIds =
    level === 'unit'
      ? [id]
      : level === 'topic'
        ? []
        : await childIds(client, 'units', 'subject_id', subjectIds)

  const topicIds = level === 'topic' ? [id] : await childIds(client, 'topics', 'unit_id', unitIds)

  const [videoCount, questionCount, flashcardCount] =
    topicIds.length === 0
      ? [0, 0, 0]
      : await Promise.all([
          countByTopics(client, 'videos', topicIds),
          countByTopics(client, 'questions', topicIds),
          countByTopics(client, 'flashcards', topicIds),
        ])

  return {
    subjectCount: level === 'exam' ? subjectIds.length : 0,
    unitCount: level === 'exam' || level === 'subject' ? unitIds.length : 0,
    topicCount: level === 'topic' ? 0 : topicIds.length,
    videoCount: videoCount ?? 0,
    questionCount: questionCount ?? 0,
    flashcardCount: flashcardCount ?? 0,
  }
}

async function childIds(
  client: Client,
  table: 'subjects' | 'units' | 'topics',
  column: 'exam_id' | 'subject_id' | 'unit_id',
  parentIds: readonly string[],
): Promise<string[]> {
  if (parentIds.length === 0) return []

  const { data, error } = await client
    .from(table)
    .select('id')
    .in(column, [...parentIds])
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Silme etkisi hesaplanamadı.')
  return (data ?? []).map((row) => row.id)
}

async function countByTopics(
  client: Client,
  table: 'videos' | 'questions' | 'flashcards',
  topicIds: readonly string[],
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .in('topic_id', [...topicIds])
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'Silme etkisi hesaplanamadı.')
  return count ?? 0
}

/* ────────────────────────── Kullanıcı yönetimi ──────────────────────────── */

export type AdminUserRow = {
  id: string
  role: Role
  fullName: string | null
  displayName: string | null
  email: string | null
  createdAt: string
  suspendedAt: string | null
  /** `daily_activity` içindeki en son gün (YYYY-MM-DD); hiç etkinlik yoksa null. */
  lastActivityDate: string | null
  subscriptionStatus: Tables<'subscriptions'>['status'] | null
  subscriptionEndsAt: string | null
}

export type AdminUserPage = {
  rows: AdminUserRow[]
  total: number
  page: number
  perPage: number
  pageCount: number
}

export type ListUsersParams = {
  /** Ad ya da e-posta parçası. Boşsa süzülmez. */
  query?: string | undefined
  role?: Role | undefined
  page: number
  perPage: number
}

/**
 * E-posta dizini: `id → email`.
 *
 * E-posta `auth.users` içindedir, `profiles` içinde DEĞİL; PostgREST o şemayı
 * açmaz. Bu yüzden GoTrue yönetim API'si sayfalanarak taranır ve service-role
 * istemcisi gerekir. `admin` parametresini çağıran taraf
 * `createSupabaseAdminClient()` ile üretir — ve yalnızca `assertRole('admin')`
 * geçtikten sonra.
 *
 * SINIR: en fazla 5.000 kullanıcı taranır. Bu sayı aşıldığında e-postaya göre
 * arama eksik sonuç verebilir; kalıcı çözüm e-postayı `profiles`e taşıyan bir
 * migration ya da `auth.users` üzerine bir görünümdür. Aynı sınır
 * `admin/abonelikler/actions.ts` içinde de var.
 */
const EMAIL_PAGE_SIZE = 200
const EMAIL_MAX_PAGES = 25

export async function getEmailIndex(admin: Client): Promise<Map<string, string>> {
  const index = new Map<string, string>()

  for (let page = 1; page <= EMAIL_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: EMAIL_PAGE_SIZE,
    })
    if (error) throw new AppError('internal', 'Kullanıcı e-postaları okunamadı.')

    const users = data?.users ?? []
    for (const user of users) {
      if (user.email) index.set(user.id, user.email)
    }
    if (users.length < EMAIL_PAGE_SIZE) break
  }

  return index
}

/** PostgREST `or(id.in.(...))` listesinin makul üst sınırı; URL uzunluğu için. */
const MAX_EMAIL_MATCHES = 200

/**
 * Sayfalanmış kullanıcı listesi.
 *
 * `emails` dizinini çağıran verir (bkz. `getEmailIndex`); bu fonksiyon
 * service-role istemcisi tutmaz, oturum istemcisiyle çalışır — `profiles`
 * okuması admin için 0011'de zaten açık.
 */
export async function listAdminUsers(
  client: Client,
  emails: ReadonlyMap<string, string>,
  params: ListUsersParams,
): Promise<AdminUserPage> {
  const page = Math.max(1, Math.trunc(params.page))
  const perPage = Math.min(100, Math.max(1, Math.trunc(params.perPage)))
  const term = (params.query ?? '').trim()

  let query = client
    .from('profiles')
    .select('id, role, full_name, display_name, created_at, suspended_at', { count: 'exact' })

  if (params.role) query = query.eq('role', params.role)

  if (term.length > 0) {
    const needle = term.toLowerCase()
    const matchedIds: string[] = []
    for (const [id, email] of emails) {
      if (email.toLowerCase().includes(needle)) {
        matchedIds.push(id)
        if (matchedIds.length >= MAX_EMAIL_MATCHES) break
      }
    }

    // PostgREST `or()` girdisinde virgül/parantez ayraçtır; kullanıcı metni
    // oraya olduğu gibi konamaz.
    const escaped = term.replace(/[,()*]/g, ' ')
    const clauses = [`full_name.ilike.*${escaped}*`, `display_name.ilike.*${escaped}*`]
    if (matchedIds.length > 0) clauses.push(`id.in.(${matchedIds.join(',')})`)
    query = query.or(clauses.join(','))
  }

  const from = (page - 1) * perPage
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1)

  if (error) throw new AppError('internal', 'Kullanıcılar yüklenemedi.')

  const profiles = data ?? []
  const ids = profiles.map((profile) => profile.id)
  const [activity, subscriptions] = await Promise.all([
    getLastActivityDates(client, ids),
    getCurrentSubscriptions(client, ids),
  ])

  const total = count ?? profiles.length

  return {
    rows: profiles.map((profile) => {
      const subscription = subscriptions.get(profile.id) ?? null
      return {
        id: profile.id,
        role: profile.role,
        fullName: profile.full_name,
        displayName: profile.display_name,
        email: emails.get(profile.id) ?? null,
        createdAt: profile.created_at,
        suspendedAt: profile.suspended_at,
        lastActivityDate: activity.get(profile.id) ?? null,
        subscriptionStatus: subscription?.status ?? null,
        subscriptionEndsAt: subscription?.ends_at ?? null,
      }
    }),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  }
}

/** Sayfadaki kullanıcıların son etkinlik günü. Tek sorgu, en yeniden eskiye. */
async function getLastActivityDates(
  client: Client,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const last = new Map<string, string>()
  if (userIds.length === 0) return last

  const { data, error } = await client
    .from('daily_activity')
    .select('user_id, date')
    .in('user_id', [...userIds])
    .order('date', { ascending: false })

  if (error) throw new AppError('internal', 'Son etkinlik okunamadı.')

  // Sıra yeniden eskiye; ilk görülen satır o kullanıcının en son günüdür.
  for (const row of data ?? []) {
    if (!last.has(row.user_id)) last.set(row.user_id, row.date)
  }
  return last
}

type SubscriptionSummary = Pick<Tables<'subscriptions'>, 'status' | 'ends_at'>

/** Sayfadaki kullanıcıların en güncel aboneliği (bitişi en ileri olan). */
async function getCurrentSubscriptions(
  client: Client,
  userIds: readonly string[],
): Promise<Map<string, SubscriptionSummary>> {
  const current = new Map<string, SubscriptionSummary>()
  if (userIds.length === 0) return current

  const { data, error } = await client
    .from('subscriptions')
    .select('user_id, status, ends_at')
    .in('user_id', [...userIds])
    .order('ends_at', { ascending: false })

  if (error) throw new AppError('internal', 'Abonelikler okunamadı.')

  for (const row of data ?? []) {
    if (!current.has(row.user_id)) {
      current.set(row.user_id, { status: row.status, ends_at: row.ends_at })
    }
  }
  return current
}

/** Tek kullanıcının tam profili; rol/askı/anonimleştirme işlemleri öncesi doğrulama için. */
export async function getAdminUser(client: Client, userId: string): Promise<Tables<'profiles'>> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) throw new AppError('internal', 'Kullanıcı okunamadı.')
  if (!data) throw new AppError('not_found', 'Kullanıcı bulunamadı.')
  return data
}

/* ──────────────────────────── Yönetim panosu ────────────────────────────── */

export type PlatformActivityPoint = {
  date: string
  videosCompleted: number
  questionsAnswered: number
}

export type PlatformActivity = {
  /** Gün gün seri; kaydı olmayan gün sıfırla döner. */
  points: PlatformActivityPoint[]
  /** Aralıkta en az bir satırı olan farklı kullanıcı sayısı. */
  activeUsers: number
  videosCompleted: number
  questionsAnswered: number
}

/**
 * Son günlerin platform etkinliği.
 *
 * `daily_activity` zaten gün başına tek satır tutuyor; toplama burada,
 * uygulama tarafında yapılır çünkü PostgREST `group by` sunmaz. Satır sayısı
 * "kullanıcı × gün" ile sınırlı ve aşağıdaki tavanla korunuyor.
 */
const ACTIVITY_SCAN_LIMIT = 20000

export async function getPlatformActivity(
  client: Client,
  dayKeys: readonly string[],
): Promise<PlatformActivity> {
  const first = dayKeys[0]
  const last = dayKeys[dayKeys.length - 1]
  if (first === undefined || last === undefined) {
    return { points: [], activeUsers: 0, videosCompleted: 0, questionsAnswered: 0 }
  }

  const { data, error } = await client
    .from('daily_activity')
    .select('user_id, date, videos_completed, questions_answered')
    .gte('date', first)
    .lte('date', last)
    .limit(ACTIVITY_SCAN_LIMIT)

  if (error) throw new AppError('internal', 'Platform etkinliği yüklenemedi.')

  const byDate = new Map<string, PlatformActivityPoint>(
    dayKeys.map((date) => [date, { date, videosCompleted: 0, questionsAnswered: 0 }]),
  )
  const users = new Set<string>()
  let videosCompleted = 0
  let questionsAnswered = 0

  for (const row of data ?? []) {
    users.add(row.user_id)
    videosCompleted += row.videos_completed
    questionsAnswered += row.questions_answered
    const point = byDate.get(row.date)
    if (point) {
      point.videosCompleted += row.videos_completed
      point.questionsAnswered += row.questions_answered
    }
  }

  return {
    points: dayKeys.map(
      (date) => byDate.get(date) ?? { date, videosCompleted: 0, questionsAnswered: 0 },
    ),
    activeUsers: users.size,
    videosCompleted,
    questionsAnswered,
  }
}

export type RevenueSummary = {
  /** Tablodaki `amount` toplamı (TL). */
  totalTry: number
  periodTry: number
  successfulPayments: number
  /** Sandbox (`mock`) sağlayıcısından gelen tahsilat sayısı; gerçek ciro değildir. */
  sandboxPayments: number
}

/**
 * Tahsilat özeti. YALNIZCA `status = 'success'` satırlar sayılır; `pending`
 * bir ödeme henüz para değildir.
 *
 * Sağlayıcı kırılımı bilerek dönülüyor: Faz 6 sandbox'ta çalışıyor ve rakamın
 * "gerçek para" sanılması bu panonun en kolay yanlış okunma biçimi.
 */
const PAYMENT_SCAN_LIMIT = 20000

export async function getRevenueSummary(client: Client, sinceIso: string): Promise<RevenueSummary> {
  const { data, error } = await client
    .from('payments')
    .select('amount, provider, created_at')
    .eq('status', 'success')
    .limit(PAYMENT_SCAN_LIMIT)

  if (error) throw new AppError('internal', 'Ciro bilgisi yüklenemedi.')

  let totalTry = 0
  let periodTry = 0
  let sandboxPayments = 0
  const rows = data ?? []

  for (const row of rows) {
    const amount = Number(row.amount)
    if (!Number.isFinite(amount)) continue
    totalTry += amount
    if (row.created_at >= sinceIso) periodTry += amount
    if (row.provider === 'mock') sandboxPayments += 1
  }

  return { totalTry, periodTry, successfulPayments: rows.length, sandboxPayments }
}

export type ContentCounts = {
  topics: number
  videos: number
  questions: number
  tests: number
  flashcards: number
}

/** İçerik sayıları — panonun editöre de açık olan tek bölümü. */
export async function getContentCounts(client: Client): Promise<ContentCounts> {
  const [topics, videos, questions, tests, flashcards] = await Promise.all([
    countTable(client, 'topics'),
    countTable(client, 'videos'),
    countTable(client, 'questions'),
    countTable(client, 'tests'),
    countTable(client, 'flashcards'),
  ])
  return { topics, videos, questions, tests, flashcards }
}

async function countTable(
  client: Client,
  table: 'topics' | 'videos' | 'questions' | 'tests' | 'flashcards',
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  if (error) throw new AppError('internal', 'İçerik sayıları yüklenemedi.')
  return count ?? 0
}

export type JobRunSummary = {
  jobName: string
  status: Tables<'job_runs'>['status']
  startedAt: string
  finishedAt: string | null
  affectedRows: number | null
  errorMessage: string | null
}

/**
 * Her cron işinin SON koşumu.
 *
 * Sessizce başarısız olan bir cron başka hiçbir ekranda görünmez; bu yüzden
 * pano işin adını, durumunu ve hata mesajını gösterir. Son `scanLimit` koşum
 * taranır ve iş adı başına ilki (en yenisi) alınır.
 */
export async function getLatestJobRuns(client: Client, scanLimit = 200): Promise<JobRunSummary[]> {
  const { data, error } = await client
    .from('job_runs')
    .select('job_name, status, started_at, finished_at, affected_rows, error_message')
    .order('started_at', { ascending: false })
    .limit(scanLimit)

  if (error) throw new AppError('internal', 'Zamanlanmış iş kayıtları yüklenemedi.')

  const latest = new Map<string, JobRunSummary>()
  for (const row of data ?? []) {
    if (latest.has(row.job_name)) continue
    latest.set(row.job_name, {
      jobName: row.job_name,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      affectedRows: row.affected_rows,
      errorMessage: row.error_message,
    })
  }

  return [...latest.values()].sort((left, right) => left.jobName.localeCompare(right.jobName, 'tr'))
}
