'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { readImportFile, ImportFormatError } from '@/lib/admin/import/csv'
import { parseImportRows, type ImportRow, type RowError } from '@/lib/admin/import/parse'
import { validateOptions } from '@/lib/admin/questions/options'
import { importRowMessage, toQuestionAppError } from '@/lib/admin/questions/db-errors'
import {
  isAllowedQuestionImageSize,
  isAllowedQuestionImageType,
  isOwnQuestionImageKey,
  QUESTION_IMAGES_BUCKET,
} from '@/lib/admin/questions/storage'
import { getTopicOptions, topicSlugMap } from '@/lib/data/admin-questions'
import {
  DeleteQuestionSchema,
  ImportCommitSchema,
  ImportFileSchema,
  SaveQuestionSchema,
  SetPublishedSchema,
  type SaveQuestionInput,
} from './schemas'

/**
 * Soru bankası mutasyonları (spec §M15).
 *
 * ── YETKİ ──────────────────────────────────────────────────────────────────
 * HEPSİ `assertRole(['editor','admin'])` ile başlar. İçerik üretmek editörün
 * işidir; kullanıcı, rol ve abonelik tarafına dokunan hiçbir şey burada yok.
 * `(admin)` düzenindeki `requireRole` bir KAPIDIR, kilit değil: Server Action
 * herkese açık bir uç noktadır ve düzenin guard'ı onu korumaz (CONVENTIONS §3).
 *
 * ── NEDEN SERVICE-ROLE ─────────────────────────────────────────────────────
 * `correct_option` ve `explanation` `authenticated` rolünden geri alınmıştır
 * (0011). Editörün soruyu düzenleyebilmesi için bu kolonları yazması ve geri
 * okuması gerekir; bu yüzden yazma yolu — ROL DENETİMİNDEN SONRA —
 * service-role istemcisiyle çalışır. İstemciden gelen hiçbir değer bir
 * `user_id`/rol filtresini parametrelemez (CONVENTIONS §4).
 */

/** Tek seferde gönderilen insert grubu; hata yalıtımı için bilinçli olarak küçük. */
const IMPORT_BATCH_SIZE = 50

export type SaveQuestionResult = { id: string; created: boolean }

export const saveQuestion = action(
  SaveQuestionSchema,
  async (input): Promise<SaveQuestionResult> => {
    const user = await assertRole(['editor', 'admin'])
    const admin = createSupabaseAdminClient()

    // Şıklar ve doğru şık: veritabanı trigger'ının denetimini burada tekrarlarız
    // ki kullanıcı alan bazlı bir mesaj görsün, ham Postgres hatası değil.
    const problem = validateOptions(input.options, input.correctOption)
    if (problem) throw optionsProblemError(problem)

    const topicExists = await topicIsUsable(admin, input.topicId)
    if (!topicExists) throw new AppError('not_found', 'Seçtiğiniz konu bulunamadı.')

    if (input.outcomeId) {
      const belongs = await outcomeBelongsToTopic(admin, input.outcomeId, input.topicId)
      if (!belongs) {
        throw new AppError('validation', 'Seçilen kazanım bu konuya ait değil.', {
          outcomeId: ['Seçilen kazanım bu konuya ait değil.'],
        })
      }
    }

    const imageUrl = await resolveImageUrl(admin, user.id, input)

    const payload = {
      topic_id: input.topicId,
      outcome_id: input.outcomeId,
      stem: input.stem,
      options: input.options,
      correct_option: input.correctOption,
      explanation: input.explanation,
      solution_video_url: input.solutionVideoUrl,
      difficulty: input.difficulty,
      expected_seconds: input.expectedSeconds,
      tags: input.tags,
      is_published: input.isPublished,
      ...(imageUrl === undefined ? {} : { image_url: imageUrl }),
    }

    if (input.id) {
      const { data, error } = await admin
        .from('questions')
        .update(payload)
        .eq('id', input.id)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle()

      if (error) throw toQuestionAppError(error, 'Soru kaydedilemedi.')
      if (!data) throw new AppError('not_found', 'Güncellenecek soru bulunamadı.')

      revalidateQuestionPaths(input.id)
      return { id: data.id, created: false }
    }

    const { data, error } = await admin
      .from('questions')
      .insert({ ...payload, type: 'multiple_choice' })
      .select('id')
      .single()

    if (error || !data) throw toQuestionAppError(error, 'Soru kaydedilemedi.')

    revalidateQuestionPaths(data.id)
    return { id: data.id, created: true }
  },
)

export const setQuestionPublished = action(SetPublishedSchema, async (input) => {
  await assertRole(['editor', 'admin'])
  const admin = createSupabaseAdminClient()

  const { data, error } = await admin
    .from('questions')
    .update({ is_published: input.isPublished })
    .eq('id', input.id)
    .is('deleted_at', null)
    .select('id, is_published')
    .maybeSingle()

  if (error) throw toQuestionAppError(error, 'Soru güncellenemedi.')
  if (!data) throw new AppError('not_found', 'Soru bulunamadı.')

  revalidateQuestionPaths(input.id)
  return { id: data.id, isPublished: data.is_published }
})

/**
 * Soruyu YUMUŞAK siler (CONVENTIONS §6: içerik tabloları hard delete edilmez).
 * Testte kullanılan soru silinmez: geçmiş oturumların sonuçları soruya bakar.
 */
export const deleteQuestion = action(DeleteQuestionSchema, async (input) => {
  await assertRole(['editor', 'admin'])
  const admin = createSupabaseAdminClient()

  const { count, error: usageError } = await admin
    .from('test_questions')
    .select('question_id', { count: 'exact', head: true })
    .eq('question_id', input.id)

  if (usageError) throw new AppError('internal', 'Sorunun test kullanımı okunamadı.')
  if ((count ?? 0) > 0) {
    throw new AppError(
      'conflict',
      'Bu soru bir testte kullanılıyor. Önce testten çıkarın ya da soruyu yayından kaldırın.',
    )
  }

  const { data, error } = await admin
    .from('questions')
    .update({ deleted_at: new Date().toISOString(), is_published: false })
    .eq('id', input.id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) throw toQuestionAppError(error, 'Soru silinemedi.')
  if (!data) throw new AppError('not_found', 'Soru bulunamadı.')

  revalidateQuestionPaths(input.id)
  return { id: data.id }
})

// ───────────────────────────────────────────────────────────────────────────
// Toplu içe aktarma
// ───────────────────────────────────────────────────────────────────────────

/** Önizlemede gösterilen satır; şıkların tamamı değil, özeti taşınır. */
export type ImportPreviewRow = {
  line: number
  stem: string
  topicSlug: string
  topicTitle: string
  optionCount: number
  correctOption: string
  difficulty: number
  expectedSeconds: number | null
}

export type ImportPreviewResult = {
  rows: ImportPreviewRow[]
  errors: RowError[]
  totalRows: number
}

/**
 * KURU ÇALIŞMA (dry-run): dosya ayrıştırılır, doğrulanır, HİÇBİR ŞEY YAZILMAZ.
 * `importQuestions` aynı dosyayı aynı saf kodla yeniden ayrıştırır; önizlemede
 * görülenle yazılan birebir aynıdır.
 */
export const previewImport = action(
  ImportFileSchema,
  async (input): Promise<ImportPreviewResult> => {
    await assertRole(['editor', 'admin'])
    const admin = createSupabaseAdminClient()

    const { result, topicTitles } = await parseUploadedFile(admin, input)

    return {
      rows: result.valid.map((row) => toPreviewRow(row, topicTitles)),
      errors: result.errors,
      totalRows: result.valid.length + countRowsWithErrors(result.errors),
    }
  },
)

export type ImportCommitResult = {
  /** Gerçekten eklenen satırların dosya numaraları. */
  insertedLines: number[]
  inserted: number
  /** Doğrulamadan geçemeyen satırlar. */
  errors: RowError[]
  /** Doğrulamayı geçip veritabanına yazılamayan satırlar. */
  failed: RowError[]
}

/**
 * Yazma.
 *
 * KISMİ BAŞARI GİZLENMEZ. Satırlar `IMPORT_BATCH_SIZE`lik gruplar hâlinde
 * gönderilir; bir grup hata alırsa o grup TEK TEK yeniden denenir. Böylece
 * rapor "hangi satır girdi, hangisi girmedi" sorusuna kesin cevap verir —
 * "içe aktarma başarısız" demek, editörü dosyayı ikinci kez yükleyip yarısını
 * çiftlemeye iter.
 *
 * PostgREST tek istekte işlem (transaction) açmadığı için gerçek bir atomiklik
 * yok; sözleşme "ya hep ya hiç" değil, "ne olduğunu tam söyle"dir.
 */
export const importQuestions = action(
  ImportCommitSchema,
  async (input): Promise<ImportCommitResult> => {
    await assertRole(['editor', 'admin'])
    const admin = createSupabaseAdminClient()

    const { result } = await parseUploadedFile(admin, input)

    if (result.valid.length === 0) {
      throw new AppError(
        'validation',
        'İçeri alınabilecek geçerli satır yok. Hataları düzeltip dosyayı tekrar yükleyin.',
      )
    }

    const insertedLines: number[] = []
    const failed: RowError[] = []

    for (let start = 0; start < result.valid.length; start += IMPORT_BATCH_SIZE) {
      const batch = result.valid.slice(start, start + IMPORT_BATCH_SIZE)
      const { error } = await admin
        .from('questions')
        .insert(batch.map((row) => toInsert(row, input.publish)))

      if (!error) {
        insertedLines.push(...batch.map((row) => row.line))
        continue
      }

      // Grup düştü: hangi satırın suçlu olduğunu ancak tek tek deneyerek
      // öğrenebiliriz. Grup küçük olduğu için maliyet kabul edilebilir.
      for (const row of batch) {
        const single = await admin.from('questions').insert(toInsert(row, input.publish))
        if (single.error) {
          failed.push({ line: row.line, column: null, message: importRowMessage(single.error) })
        } else {
          insertedLines.push(row.line)
        }
      }
    }

    revalidatePath('/admin/sorular')

    return {
      insertedLines: insertedLines.sort((left, right) => left - right),
      inserted: insertedLines.length,
      errors: result.errors,
      failed,
    }
  },
)

// ───────────────────────────────────────────────────────────────────────────
// Yardımcılar (sunucuya özel)
// ───────────────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function parseUploadedFile(admin: AdminClient, input: { fileName: string; content: string }) {
  const topics = await getTopicOptions(admin)

  let read
  try {
    read = readImportFile(input.content, input.fileName)
  } catch (error) {
    if (error instanceof ImportFormatError) throw new AppError('validation', error.message)
    throw error
  }

  const result = parseImportRows({
    rows: read.rows,
    columns: read.columns,
    topics: topicSlugMap(topics),
    headerLine: read.headerLine,
  })

  const topicTitles = new Map(topics.map((topic) => [topic.slug, topic.title]))
  return { result, topicTitles }
}

function toPreviewRow(row: ImportRow, titles: Map<string, string>): ImportPreviewRow {
  return {
    line: row.line,
    stem: row.stem,
    topicSlug: row.topicSlug,
    topicTitle: titles.get(row.topicSlug) ?? row.topicSlug,
    optionCount: row.options.length,
    correctOption: row.correctOption,
    difficulty: row.difficulty,
    expectedSeconds: row.expectedSeconds,
  }
}

/** Aynı satırda birden çok hata olabilir; sayım satır bazında yapılır. */
function countRowsWithErrors(errors: readonly RowError[]): number {
  return new Set(errors.map((error) => error.line)).size
}

function toInsert(row: ImportRow, publish: boolean) {
  return {
    topic_id: row.topicId,
    type: 'multiple_choice' as const,
    stem: row.stem,
    options: row.options,
    correct_option: row.correctOption,
    explanation: row.explanation,
    difficulty: row.difficulty,
    expected_seconds: row.expectedSeconds,
    is_published: publish,
  }
}

function optionsProblemError(problem: NonNullable<ReturnType<typeof validateOptions>>): AppError {
  switch (problem.kind) {
    case 'too_few':
      return new AppError('validation', 'Soru en az 2 şık içermeli.', {
        options: ['Soru en az 2 şık içermeli.'],
      })
    case 'too_many':
      return new AppError('validation', 'Soru en fazla 5 şık içerebilir.', {
        options: ['Soru en fazla 5 şık içerebilir.'],
      })
    case 'correct_empty':
      return new AppError('validation', 'Doğru şık boş bırakılamaz.', {
        correctOption: [`"${problem.key}" şıkkının metni boş; dolu bir şık seçin.`],
      })
    case 'correct_missing':
    default:
      return new AppError('validation', 'Doğru şıkkı seçin.', {
        correctOption: ['Doğru şık, girdiğiniz şıklardan biri olmalı.'],
      })
  }
}

async function topicIsUsable(admin: AdminClient, topicId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('topics')
    .select('id')
    .eq('id', topicId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Konu doğrulanamadı.')
  return Boolean(data)
}

async function outcomeBelongsToTopic(
  admin: AdminClient,
  outcomeId: string,
  topicId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('outcomes')
    .select('id')
    .eq('id', outcomeId)
    .eq('topic_id', topicId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Kazanım doğrulanamadı.')
  return Boolean(data)
}

/**
 * Görselin son hâlini belirler.
 *
 * `undefined` → dokunma, `null` → temizle, string → yeni anahtar.
 * Yeni anahtar SUNUCUDA doğrulanır: doğru klasörde mi, türü ve boyutu
 * kabul edilebilir mi. Tarayıcıdaki denetim bir kolaylıktır; gerçek denetim
 * nesnenin kendi meta verisi üzerinden burada yapılır ve geçersiz dosya
 * kovadan silinir (yoksa kova çöple dolar).
 */
async function resolveImageUrl(
  admin: AdminClient,
  userId: string,
  input: SaveQuestionInput,
): Promise<string | null | undefined> {
  if (input.imageKey === undefined) return undefined
  if (input.imageKey === null) return null

  const key = input.imageKey
  if (!isOwnQuestionImageKey(key, userId)) {
    throw new AppError('validation', 'Görsel bağlantısı geçerli değil.', {
      imageKey: ['Görsel yeniden yüklenmeli.'],
    })
  }

  const folder = key.slice(0, key.indexOf('/'))
  const name = key.slice(key.indexOf('/') + 1)

  const { data, error } = await admin.storage
    .from(QUESTION_IMAGES_BUCKET)
    .list(folder, { search: name, limit: 1 })

  const object = data?.find((entry) => entry.name === name)
  if (error || !object) {
    throw new AppError('validation', 'Yüklenen görsel bulunamadı. Tekrar deneyin.', {
      imageKey: ['Yüklenen görsel bulunamadı.'],
    })
  }

  const meta = object.metadata as { size?: number; mimetype?: string } | null
  const size = Number(meta?.size ?? 0)
  const mimetype = meta?.mimetype ?? null

  if (!isAllowedQuestionImageType(mimetype) || !isAllowedQuestionImageSize(size)) {
    await admin.storage.from(QUESTION_IMAGES_BUCKET).remove([key])
    throw new AppError('validation', 'Görsel JPEG, PNG, WEBP ya da GIF ve en fazla 5 MB olmalı.', {
      imageKey: ['Görsel JPEG, PNG, WEBP ya da GIF ve en fazla 5 MB olmalı.'],
    })
  }

  return admin.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(key).data.publicUrl
}

function revalidateQuestionPaths(id: string): void {
  revalidatePath('/admin/sorular')
  revalidatePath(`/admin/sorular/${id}`)
}
