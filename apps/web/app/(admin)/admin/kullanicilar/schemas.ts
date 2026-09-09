import { z } from 'zod'
import { ROLES } from '@/lib/roles'

/**
 * Kullanıcı yönetimi girdileri (spec §M15, §10).
 *
 * Üçü de YALNIZCA `admin` rolüne açıktır; denetim `actions.ts` içinde, her
 * action'ın kendi ilk satırındadır.
 */

const Uuid = z.string().uuid({ message: 'Geçersiz kullanıcı kimliği.' })

export const RoleSchema = z.enum(ROLES)

export const ChangeRoleSchema = z.object({
  userId: Uuid,
  role: RoleSchema,
})
export type ChangeRoleInput = z.infer<typeof ChangeRoleSchema>

export const SetSuspensionSchema = z.object({
  userId: Uuid,
  /** true: askıya al, false: yeniden etkinleştir. */
  suspended: z.coerce.boolean(),
})
export type SetSuspensionInput = z.infer<typeof SetSuspensionSchema>

/**
 * Anonimleştirme geri alınamaz; bu yüzden yazılı onay istenir.
 * Metin İSTEMCİDE değil BURADA doğrulanır: onay kutusunu atlayan bir istek
 * doğrudan action'a gelebilir.
 */
export const ANONYMIZE_CONFIRMATION = 'ANONİMLEŞTİR'

export const AnonymizeUserSchema = z.object({
  userId: Uuid,
  confirmation: z.string().trim(),
})
export type AnonymizeUserInput = z.infer<typeof AnonymizeUserSchema>

/**
 * Liste ekranının arama/süzme parametreleri (URL'den okunur).
 *
 * Her alan `.catch()` taşır: elle yazılmış ya da bozuk bir sorgu dizgisi
 * yönetim ekranını hata sayfasına düşürmemeli, süzgeci yok saymalıdır.
 */
export const UserListParamsSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  role: RoleSchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
})
export type UserListParams = z.infer<typeof UserListParamsSchema>

export const USERS_PER_PAGE = 20
