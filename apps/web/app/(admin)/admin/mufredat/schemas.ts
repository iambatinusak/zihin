import { z } from 'zod'

/**
 * Müfredat düzenleyicisinin girdi şemaları (spec §M15).
 *
 * Sınırlar veritabanındaki `check` kısıtlarıyla BİREBİR aynı tutuldu
 * (0003_curriculum.sql): zorluk 1-5, süre 1-600 dakika, ağırlık 0-1, yanlış
 * bölen yalnızca 3 ya da 4. Şema gevşek olsaydı kullanıcı anlaşılmaz bir
 * Postgres hatası görürdü; sıkı olsaydı geçerli içerik reddedilirdi.
 */

export const CURRICULUM_LEVELS = ['exam', 'subject', 'unit', 'topic'] as const
export const CurriculumLevelSchema = z.enum(CURRICULUM_LEVELS)
export type CurriculumLevelInput = z.infer<typeof CurriculumLevelSchema>

const Uuid = z.string().uuid({ message: 'Geçersiz kayıt kimliği.' })

/**
 * Slug URL'de görünür ve `(üst kayıt, slug)` ikilisi benzersizdir. Türkçe
 * karakterlere izin verilmez: URL'de yüzde kodlamasına dönüşür ve paylaşılan
 * bağlantılar okunamaz hâle gelir.
 */
const Slug = z
  .string()
  .trim()
  .min(2, 'Kısa ad en az 2 karakter olmalıdır.')
  .max(80, 'Kısa ad en fazla 80 karakter olabilir.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Kısa ad yalnızca küçük harf, rakam ve tire içerebilir (örnek: temel-kavramlar).',
  )

const Name = z
  .string()
  .trim()
  .min(2, 'Ad en az 2 karakter olmalıdır.')
  .max(160, 'Ad en fazla 160 karakter olabilir.')

/* ─────────────────────────────── Sınav ──────────────────────────────────── */

export const SaveExamSchema = z.object({
  /** Boşsa yeni kayıt açılır. */
  id: Uuid.optional(),
  code: z
    .string()
    .trim()
    .min(2, 'Kod en az 2 karakter olmalıdır.')
    .max(32, 'Kod en fazla 32 karakter olabilir.')
    .regex(/^[A-Z0-9_]+$/, 'Kod yalnızca büyük harf, rakam ve alt çizgi içerebilir (örnek: TYT).'),
  name: Name,
  description: z.string().trim().max(500, 'Açıklama en fazla 500 karakter olabilir.').optional(),
  wrongPenaltyDivisor: z.coerce
    .number()
    .int()
    .refine((value) => value === 3 || value === 4, 'Yanlış böleni yalnızca 3 ya da 4 olabilir.'),
  isActive: z.coerce.boolean(),
})
export type SaveExamInput = z.infer<typeof SaveExamSchema>

/* ─────────────────────────────── Ders ───────────────────────────────────── */

export const SaveSubjectSchema = z.object({
  id: Uuid.optional(),
  examId: Uuid,
  name: Name,
  slug: Slug,
  /** Isı haritası tonu: `243 75% 52%` biçiminde HSL üçlüsü (bkz. 0003 yorumu). */
  color: z
    .string()
    .trim()
    .regex(/^\d{1,3} \d{1,3}% \d{1,3}%$/, 'Renk "243 75% 52%" biçiminde bir HSL üçlüsü olmalıdır.')
    .optional()
    .or(z.literal('')),
  questionCount: z.coerce
    .number()
    .int('Soru sayısı tam sayı olmalıdır.')
    .min(0, 'Soru sayısı negatif olamaz.')
    .max(500, 'Soru sayısı en fazla 500 olabilir.')
    .optional(),
})
export type SaveSubjectInput = z.infer<typeof SaveSubjectSchema>

/* ─────────────────────────────── Ünite ──────────────────────────────────── */

export const SaveUnitSchema = z.object({
  id: Uuid.optional(),
  subjectId: Uuid,
  name: Name,
  slug: Slug,
})
export type SaveUnitInput = z.infer<typeof SaveUnitSchema>

/* ─────────────────────────────── Konu ───────────────────────────────────── */

export const SaveTopicSchema = z.object({
  id: Uuid.optional(),
  unitId: Uuid,
  title: Name,
  slug: Slug,
  estimatedMinutes: z.coerce
    .number()
    .int('Süre tam dakika olmalıdır.')
    .min(1, 'Süre en az 1 dakika olmalıdır.')
    .max(600, 'Süre en fazla 600 dakika (10 saat) olabilir.'),
  difficulty: z.coerce
    .number()
    .int('Zorluk tam sayı olmalıdır.')
    .min(1, 'Zorluk en az 1 olabilir.')
    .max(5, 'Zorluk en fazla 5 olabilir.'),
  examWeight: z.coerce
    .number()
    .min(0, 'Sınav ağırlığı 0 ile 1 arasında olmalıdır.')
    .max(1, 'Sınav ağırlığı 0 ile 1 arasında olmalıdır.'),
  /** Markdown; sunucuda `Markdown` bileşeniyle temizlenerek basılır. */
  memoryNote: z
    .string()
    .trim()
    .max(8000, 'Hafıza notu en fazla 8000 karakter olabilir.')
    .optional(),
})
export type SaveTopicInput = z.infer<typeof SaveTopicSchema>

/* ───────────────────────── Sıralama ve silme ────────────────────────────── */

/**
 * Sürükle bırak ve "Yukarı/Aşağı taşı" AYNI action'ı çağırır: klavye yolu
 * ikinci bir kod yolu değil, aynı işlemin başka bir tetikleyicisidir.
 * `orderedIds` kardeşlerin YENİ sırasıdır; sunucu bunu mevcut sırayla
 * karşılaştırıp yalnızca değişen satırları yazar.
 */
export const ReorderSchema = z.object({
  level: CurriculumLevelSchema,
  /** Sınav düzeyinde üst kayıt yoktur; diğer düzeylerde zorunludur. */
  parentId: Uuid.optional(),
  movedId: Uuid,
  toIndex: z.coerce.number().int().min(0, 'Hedef konum geçersiz.'),
})
export type ReorderInput = z.infer<typeof ReorderSchema>

export const DeleteNodeSchema = z.object({
  level: CurriculumLevelSchema,
  id: Uuid,
})
export type DeleteNodeInput = z.infer<typeof DeleteNodeSchema>

export const ImpactSchema = DeleteNodeSchema
