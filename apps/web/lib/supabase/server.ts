import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@zihin/db/types'

/**
 * Sunucu tarafı Supabase istemcisi (RSC, Server Action, Route Handler).
 * Oturum çerezleri üzerinden kullanıcı bağlamını taşır; RLS geçerlidir.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  // @supabase/ssr (0.5.x) jenerikleri supabase-js 2.116 öncesi sıraya göre
  // yazılmış; dönen tip şemayı `never` olarak çözüyor ve bütün sorgular tipsiz
  // kalıyor. Dönüş tipi burada bir kez sabitlenir — çağıran taraflar (özellikle
  // lib/data/*) böylece gerçek satır tiplerini görür.
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component içinden çerez yazılamaz. Oturum yenileme
            // middleware'de yapıldığı için bu durum güvenle yok sayılabilir.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>
}
