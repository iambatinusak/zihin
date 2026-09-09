/** Sistemdeki roller. Bir kullanıcı tek rol taşır (MVP sadeliği). */
export const ROLES = ['student', 'parent', 'teacher', 'editor', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Öğrenci',
  parent: 'Veli',
  teacher: 'Öğretmen',
  editor: 'İçerik Editörü',
  admin: 'Yönetici',
}

/** Rolün varsayılan açılış sayfası. */
export const ROLE_HOME: Record<Role, string> = {
  student: '/dashboard',
  parent: '/veli',
  teacher: '/ogretmen/sorular',
  editor: '/admin/mufredat',
  admin: '/admin/dashboard',
}

/** İçerik (video/soru/test) üretebilen roller. */
export const CONTENT_ROLES: Role[] = ['editor', 'admin']

/** İçeriği izleyip çözebilen roller. */
export const LEARNER_ROLES: Role[] = ['student', 'teacher', 'editor', 'admin']

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
