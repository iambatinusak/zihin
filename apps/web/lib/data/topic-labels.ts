import 'server-only'

import type { DataClient } from './client'
import { AppError } from '@/lib/errors'

/**
 * Konu kimliklerini okunur etiketlere çevirir.
 *
 * Test sonucu ekranı kırılımı konu kimliğiyle üretir (`summarise` yalnızca
 * kimlik taşır); kullanıcıya "a3f1-…" değil "Türev — Matematik" gösterilmeli ve
 * satırdan konuya dönülebilmeli. Üç düz sorgu: konu → ünite → ders. İç içe
 * select kullanılmaz (CONVENTIONS §5: üretilen tipler ilişki taşımıyor).
 *
 * Silinmiş (soft-deleted) konu da etiketlenir: geçmiş bir testin sonucunda
 * konunun adı görünmeye devam etmeli, sonradan kaldırılmış olsa bile.
 */

export type TopicLabelRow = {
  topicId: string
  topicTitle: string
  topicSlug: string
  unitId: string
  unitName: string
  unitSlug: string
  subjectId: string
  subjectName: string
  subjectSlug: string
}

export async function getTopicLabels(
  client: DataClient,
  topicIds: readonly string[],
): Promise<Map<string, TopicLabelRow>> {
  const unique = [...new Set(topicIds)]
  if (unique.length === 0) return new Map()

  const { data: topics, error: topicError } = await client
    .from('topics')
    .select('id, title, slug, unit_id')
    .in('id', unique)

  if (topicError) throw new AppError('internal', 'Konu bilgisi yüklenemedi.')
  const topicRows = topics ?? []
  if (topicRows.length === 0) return new Map()

  const { data: units, error: unitError } = await client
    .from('units')
    .select('id, name, slug, subject_id')
    .in('id', [...new Set(topicRows.map((topic) => topic.unit_id))])

  if (unitError) throw new AppError('internal', 'Konu bilgisi yüklenemedi.')
  const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]))

  const { data: subjects, error: subjectError } = await client
    .from('subjects')
    .select('id, name, slug')
    .in('id', [...new Set((units ?? []).map((unit) => unit.subject_id))])

  if (subjectError) throw new AppError('internal', 'Konu bilgisi yüklenemedi.')
  const subjectById = new Map((subjects ?? []).map((subject) => [subject.id, subject]))

  const labels = new Map<string, TopicLabelRow>()
  for (const topic of topicRows) {
    const unit = unitById.get(topic.unit_id)
    const subject = unit ? subjectById.get(unit.subject_id) : undefined
    // Ünite ya da ders okunamadıysa konu yine listelenir; yalnızca ders adı ve
    // bağlantı eksik kalır. Eksik bir satır, kayıp bir satırdan iyidir.
    if (!unit || !subject) continue
    labels.set(topic.id, {
      topicId: topic.id,
      topicTitle: topic.title,
      topicSlug: topic.slug,
      unitId: unit.id,
      unitName: unit.name,
      unitSlug: unit.slug,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectSlug: subject.slug,
    })
  }
  return labels
}
