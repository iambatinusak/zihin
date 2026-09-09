import 'server-only'

import type { DataClient } from './client'
import { AppError } from '@/lib/errors'

/**
 * Kimlik akışının ihtiyaç duyduğu okumalar.
 *
 * Not: bu dosya `lib/data/index.ts` üzerinden dışa aktarılmaz; barrel dosyası
 * paylaşılan bir dosya ve paralel çalışan özelliklerde çakışıyor. İçe aktarım
 * doğrudan `@/lib/data/auth` yolundan yapılır.
 */

export type InviteCodeOwner = {
  id: string
  fullName: string | null
}

/**
 * Davet kodunun sahibi öğrenciyi döner; kod yoksa `null`.
 *
 * Anon oturum `profiles` tablosunda başkasının satırını okuyamaz (RLS), bu
 * yüzden kayıt sırasında service-role istemcisiyle çağrılır. Sorgu yalnızca
 * kodun kendisiyle parametrelenir, hiçbir kimlik alanı istemciden gelmez.
 */
export async function findStudentByInviteCode(
  client: DataClient,
  inviteCode: string,
): Promise<InviteCodeOwner | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, role')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Davet kodu doğrulanamadı.')
  if (!data) return null
  // Davet kodu her profilde var; yalnızca öğrenci kodu veli bağı kurabilir.
  if (data.role !== 'student') return null

  return { id: data.id, fullName: data.full_name }
}
