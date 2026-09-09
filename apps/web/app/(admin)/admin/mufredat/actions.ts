'use server'

import { revalidatePath } from 'next/cache'

import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { CONTENT_ROLES } from '@/lib/roles'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { computeReorder, nextOrderIndex, type Orderable } from '@/lib/admin/reorder'
import { getDeleteImpact, type CurriculumLevel, type DeleteImpact } from '@/lib/data/admin'
import {
  DeleteNodeSchema,
  ImpactSchema,
  ReorderSchema,
  SaveExamSchema,
  SaveSubjectSchema,
  SaveTopicSchema,
  SaveUnitSchema,
} from './schemas'

/**
 * Müfredat düzenleyicisinin mutasyonları (spec §M15).
 *
 * ── YETKİ ──────────────────────────────────────────────────────────────────
 * HEPSİ `assertRole(CONTENT_ROLES)` — yani `editor` ve `admin`. Müfredat
 * içeriktir; editörün asıl işi budur. Rol, para ve hesap işlemleri BURADA
 * DEĞİL, `admin/kullanicilar/actions.ts` içindedir ve orada `assertRole('admin')`
 * ile korunur.
 *
 * Denetim her action'ın kendi ilk satırındadır. `(admin)/layout.tsx` içindeki
 * `requireRole` yalnızca sayfayı gizler; Server Action ayrı bir uç noktadır ve
 * düzenden geçmez (CONVENTIONS §3).
 *
 * ── İSTEMCİ ────────────────────────────────────────────────────────────────
 * Normal oturum istemcisi. 0011'deki `*_insert_editor` / `*_update_editor`
 * politikaları `is_editor()` ile zaten yazma izni veriyor; service-role
 * gerekmiyor ve RLS ikinci bir güvenlik ağı olarak açık kalıyor.
 */

const PATH = '/admin/mufredat'

type Level = CurriculumLevel

/** Düzey → tablo ve üst kayıt kolonu. Tek yerde durur, dört action da buradan okur. */
const LEVELS = {
  exam: { table: 'exams', parentColumn: null },
  subject: { table: 'subjects', parentColumn: 'exam_id' },
  unit: { table: 'units', parentColumn: 'subject_id' },
  topic: { table: 'topics', parentColumn: 'unit_id' },
} as const satisfies Record<Level, { table: string; parentColumn: string | null }>

export type SaveNodeResult = { id: string; created: boolean }

/* ─────────────────────────────── Sınav ──────────────────────────────────── */

export const saveExam = action(SaveExamSchema, async (input): Promise<SaveNodeResult> => {
  await assertRole(CONTENT_ROLES)
  const supabase = await createSupabaseServerClient()

  const fields = {
    code: input.code,
    name: input.name,
    description: emptyToNull(input.description),
    wrong_penalty_divisor: input.wrongPenaltyDivisor,
    is_active: input.isActive,
  }

  if (input.id) {
    const { error } = await supabase.from('exams').update(fields).eq('id', input.id)
    if (error) throw writeError(error, 'Sınav kaydedilemedi.')
    revalidatePath(PATH)
    return { id: input.id, created: false }
  }

  const orderIndex = nextOrderIndex(await siblings(supabase, 'exam', null))
  const { data, error } = await supabase
    .from('exams')
    .insert({ ...fields, order_index: orderIndex })
    .select('id')
    .single()

  if (error || !data) throw writeError(error, 'Sınav oluşturulamadı.')
  revalidatePath(PATH)
  return { id: data.id, created: true }
})

/* ─────────────────────────────── Ders ───────────────────────────────────── */

export const saveSubject = action(SaveSubjectSchema, async (input): Promise<SaveNodeResult> => {
  await assertRole(CONTENT_ROLES)
  const supabase = await createSupabaseServerClient()

  const fields = {
    exam_id: input.examId,
    name: input.name,
    slug: input.slug,
    color: emptyToNull(input.color),
    question_count: input.questionCount ?? null,
  }

  if (input.id) {
    const { error } = await supabase.from('subjects').update(fields).eq('id', input.id)
    if (error) throw writeError(error, 'Ders kaydedilemedi.')
    revalidatePath(PATH)
    return { id: input.id, created: false }
  }

  const orderIndex = nextOrderIndex(await siblings(supabase, 'subject', input.examId))
  const { data, error } = await supabase
    .from('subjects')
    .insert({ ...fields, order_index: orderIndex })
    .select('id')
    .single()

  if (error || !data) throw writeError(error, 'Ders oluşturulamadı.')
  revalidatePath(PATH)
  return { id: data.id, created: true }
})

/* ─────────────────────────────── Ünite ──────────────────────────────────── */

export const saveUnit = action(SaveUnitSchema, async (input): Promise<SaveNodeResult> => {
  await assertRole(CONTENT_ROLES)
  const supabase = await createSupabaseServerClient()

  const fields = { subject_id: input.subjectId, name: input.name, slug: input.slug }

  if (input.id) {
    const { error } = await supabase.from('units').update(fields).eq('id', input.id)
    if (error) throw writeError(error, 'Ünite kaydedilemedi.')
    revalidatePath(PATH)
    return { id: input.id, created: false }
  }

  const orderIndex = nextOrderIndex(await siblings(supabase, 'unit', input.subjectId))
  const { data, error } = await supabase
    .from('units')
    .insert({ ...fields, order_index: orderIndex })
    .select('id')
    .single()

  if (error || !data) throw writeError(error, 'Ünite oluşturulamadı.')
  revalidatePath(PATH)
  return { id: data.id, created: true }
})

/* ─────────────────────────────── Konu ───────────────────────────────────── */

export const saveTopic = action(SaveTopicSchema, async (input): Promise<SaveNodeResult> => {
  await assertRole(CONTENT_ROLES)
  const supabase = await createSupabaseServerClient()

  const fields = {
    unit_id: input.unitId,
    title: input.title,
    slug: input.slug,
    estimated_minutes: input.estimatedMinutes,
    difficulty: input.difficulty,
    exam_weight: input.examWeight,
    memory_note: emptyToNull(input.memoryNote),
  }

  if (input.id) {
    const { error } = await supabase.from('topics').update(fields).eq('id', input.id)
    if (error) throw writeError(error, 'Konu kaydedilemedi.')
    revalidatePath(PATH)
    return { id: input.id, created: false }
  }

  const orderIndex = nextOrderIndex(await siblings(supabase, 'topic', input.unitId))
  const { data, error } = await supabase
    .from('topics')
    .insert({ ...fields, order_index: orderIndex })
    .select('id')
    .single()

  if (error || !data) throw writeError(error, 'Konu oluşturulamadı.')
  revalidatePath(PATH)
  return { id: data.id, created: true }
})

/* ────────────────────────────── Sıralama ────────────────────────────────── */

export type ReorderResult = {
  /** Yazılan satır sayısı; 0 ise taşıma sonuçsuz kaldı (aynı yere bırakma). */
  updated: number
}

/**
 * Kardeşler arası sıra değiştirme.
 *
 * TEK YAZMA: `computeReorder` yalnızca eski ve yeni konum ARASINDAKİ
 * satırları döner; bunlar tek bir `upsert` ile gönderilir. N ayrı istek de
 * yoktur, tablonun tamamını yeniden yazma da.
 *
 * Sürükle bırak ile klavye menüsü aynı yolu kullanır — davranışın ikiye
 * ayrılmaması için.
 */
export const reorderNodes = action(ReorderSchema, async (input): Promise<ReorderResult> => {
  await assertRole(CONTENT_ROLES)
  const supabase = await createSupabaseServerClient()

  const config = LEVELS[input.level]
  if (config.parentColumn !== null && !input.parentId) {
    throw new AppError('validation', 'Üst kayıt belirtilmedi.')
  }

  const rows = await siblingRows(supabase, input.level, input.parentId ?? null)
  const patches = computeReorder(
    rows.map((row) => ({ id: row.id, orderIndex: row.order_index })),
    input.movedId,
    input.toIndex,
  )
  if (patches.length === 0) return { updated: 0 }

  const byId = new Map(rows.map((row) => [row.id, row]))
  const payload = patches.flatMap((patch) => {
    const row = byId.get(patch.id)
    return row ? [{ ...row, order_index: patch.orderIndex }] : []
  })

  // Tam satır gönderiliyor: `upsert` bir INSERT ... ON CONFLICT UPDATE'tir ve
  // eksik NOT NULL kolonuyla reddedilir. Satırlar zaten var, çakışma daima
  // UPDATE'e düşer; `updated_at` tablo trigger'ıyla tazelenir.
  const { error } = await upsertRows(supabase, input.level, payload)
  if (error) throw writeError(error, 'Sıra kaydedilemedi.')

  revalidatePath(PATH)
  return { updated: payload.length }
})

/* ─────────────────────────── Yumuşak silme ──────────────────────────────── */

export type DeleteNodeResult = { id: string; impact: DeleteImpact }

/**
 * Yumuşak silme: `deleted_at` yazılır, satır kalır (CONVENTIONS §6).
 * Böylece geçmiş denemeler ve ilerleme kayıtları kırık referansa düşmez.
 *
 * Alt düğümler AYRICA işaretlenmez: ağaç okuması üstten aşağı yürüdüğü için
 * gizlenen düğümün altı zaten görünmez olur. Etki sayıları sonuçla birlikte
 * döner, kullanıcı ne gizlediğini görür.
 */
export const softDeleteNode = action(DeleteNodeSchema, async (input): Promise<DeleteNodeResult> => {
  await assertRole(CONTENT_ROLES)
  const supabase = await createSupabaseServerClient()

  const impact = await getDeleteImpact(supabase, input.level, input.id)
  const deletedAt = new Date().toISOString()

  const table = LEVELS[input.level].table
  const { error } =
    table === 'exams'
      ? await supabase.from('exams').update({ deleted_at: deletedAt }).eq('id', input.id)
      : table === 'subjects'
        ? await supabase.from('subjects').update({ deleted_at: deletedAt }).eq('id', input.id)
        : table === 'units'
          ? await supabase.from('units').update({ deleted_at: deletedAt }).eq('id', input.id)
          : await supabase.from('topics').update({ deleted_at: deletedAt }).eq('id', input.id)

  if (error) throw writeError(error, 'Kayıt silinemedi.')

  revalidatePath(PATH)
  return { id: input.id, impact }
})

/** Silme onayı açılmadan önce "ne gizlenecek" sayıları. Yazma yapmaz. */
export const previewDeleteImpact = action(ImpactSchema, async (input): Promise<DeleteImpact> => {
  await assertRole(CONTENT_ROLES)
  const supabase = await createSupabaseServerClient()
  return getDeleteImpact(supabase, input.level, input.id)
})

/* ────────────────────────────── Yardımcılar ─────────────────────────────── */

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

type SiblingRow = { id: string; order_index: number } & Record<string, unknown>

/** Kardeşlerin TAM satırları; `upsert` eksik kolonla çalışamaz. */
async function siblingRows(
  supabase: ServerClient,
  level: Level,
  parentId: string | null,
): Promise<SiblingRow[]> {
  const order = { ascending: true } as const

  if (level === 'exam') {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .is('deleted_at', null)
      .order('order_index', order)
    if (error) throw writeError(error, 'Sıra okunamadı.')
    return data ?? []
  }
  if (level === 'subject') {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('exam_id', parentId ?? '')
      .is('deleted_at', null)
      .order('order_index', order)
    if (error) throw writeError(error, 'Sıra okunamadı.')
    return data ?? []
  }
  if (level === 'unit') {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('subject_id', parentId ?? '')
      .is('deleted_at', null)
      .order('order_index', order)
    if (error) throw writeError(error, 'Sıra okunamadı.')
    return data ?? []
  }

  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('unit_id', parentId ?? '')
    .is('deleted_at', null)
    .order('order_index', order)
  if (error) throw writeError(error, 'Sıra okunamadı.')
  return data ?? []
}

/** Yeni kaydın sıra numarasını bulmak için yeterli olan hafif okuma. */
async function siblings(
  supabase: ServerClient,
  level: Level,
  parentId: string | null,
): Promise<Orderable[]> {
  const rows = await siblingRows(supabase, level, parentId)
  return rows.map((row) => ({ id: row.id, orderIndex: row.order_index }))
}

async function upsertRows(
  supabase: ServerClient,
  level: Level,
  payload: SiblingRow[],
): Promise<{ error: unknown }> {
  const options = { onConflict: 'id' } as const

  if (level === 'exam') {
    return supabase.from('exams').upsert(payload as never, options)
  }
  if (level === 'subject') {
    return supabase.from('subjects').upsert(payload as never, options)
  }
  if (level === 'unit') {
    return supabase.from('units').upsert(payload as never, options)
  }
  return supabase.from('topics').upsert(payload as never, options)
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed.length === 0 ? null : trimmed
}

/**
 * Postgres hatasını kullanıcıya gösterilebilir bir mesaja çevirir.
 * Benzersizlik ihlali `conflict` olarak döner; kullanıcı "kısa ad zaten var"
 * bilgisini görsün, genel bir "beklenmeyen hata" değil.
 */
function writeError(error: unknown, fallback: string): AppError {
  const code = (error as { code?: string } | null)?.code
  if (code === '23505') {
    return new AppError('conflict', 'Bu kısa ad (slug) ya da kod zaten kullanılıyor.')
  }
  if (code === '23514') {
    return new AppError('validation', 'Girilen değerler izin verilen aralığın dışında.')
  }
  console.error('[mufredat] yazma hatası:', error)
  return new AppError('internal', fallback)
}
