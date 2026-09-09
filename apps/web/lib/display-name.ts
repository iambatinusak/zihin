import type { SessionProfile } from '@/lib/auth'

/**
 * Arayüzde gösterilecek ad. Takma ad > tam ad > e-postanın kullanıcı kısmı
 * sırasıyla denenir; hiçbir durumda boş dönmez.
 */
export function displayNameOf(user: SessionProfile): string {
  const fromEmail = user.email.split('@')[0] ?? ''
  return user.displayName?.trim() || user.fullName?.trim() || fromEmail || 'Kullanıcı'
}
