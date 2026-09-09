import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * E-posta adresleri `auth.users` içindedir, `public.profiles` içinde değil.
 * Bu yüzden adres okuması yalnızca service-role istemcisiyle ve Admin API
 * üzerinden yapılabilir (CONVENTIONS §4, meşru kullanım (1): cron).
 *
 * Sorgu doğrudan kullanıcı girdisiyle parametrelenmez: buraya gelen kimlikler
 * her zaman sunucunun kendi sorgusundan (cron partisi, oturumdaki kullanıcı)
 * çıkar, istek gövdesinden değil.
 *
 * `getUserEmails` FIRLATMAZ: bir alıcının adresi okunamazsa o alıcı haritada
 * yer almaz ve e-postası atlanır; parti devam eder.
 */

type AdminAuthClient = Pick<SupabaseClient, 'auth'>

/** Tek kullanıcının doğrulanmış e-posta adresi; yoksa null. */
export async function getUserEmail(admin: AdminAuthClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error) {
      console.error(`[mail] ${userId} için e-posta adresi okunamadı:`, error)
      return null
    }
    const email = data?.user?.email ?? null
    return email && email.trim() !== '' ? email : null
  } catch (error) {
    console.error(`[mail] ${userId} için e-posta adresi okunamadı:`, error)
    return null
  }
}

/**
 * Toplu adres okuması. Admin API tek tek kimlik sorgular; parti boyutu
 * gönderim listesinin kendisiyle sınırlı olduğu için (tercihi açık kullanıcılar)
 * bu kabul edilebilir. Sıralı çalışır — Admin API'yi paralel yormanın kazancı
 * yok, hız sınırına takılma riski var.
 */
export async function getUserEmails(
  admin: AdminAuthClient,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const emails = new Map<string, string>()

  for (const userId of new Set(userIds)) {
    const email = await getUserEmail(admin, userId)
    if (email) emails.set(userId, email)
  }

  return emails
}
