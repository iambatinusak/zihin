import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@zihin/db/types'

/**
 * Service-role istemcisi — RLS'Yİ DEVRE DIŞI BIRAKIR.
 *
 * Yalnızca şu durumlarda kullanın:
 *  - cron / webhook gibi kullanıcı bağlamı olmayan işlemler,
 *  - doğru cevabın istemciye sızmaması gereken sunucu tarafı doğrulamalar,
 *  - yönetim işlemleri (kullanıcı anonimleştirme, elle abonelik tanımlama).
 *
 * ASLA bir Client Component'ten ya da doğrudan kullanıcı girdisiyle
 * parametrelenmiş şekilde çağrılmamalıdır.
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY tanımlı değil. Bu işlem servis anahtarı gerektiriyor.',
    )
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
