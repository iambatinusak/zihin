'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@zihin/db/types'

/**
 * Tarayıcı tarafı Supabase istemcisi.
 * Anon key kullanır; tüm yetki denetimi veritabanında RLS ile yapılır.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

let browserClient: ReturnType<typeof createClient> | null = null

/** Uygulama boyunca tek bir tarayıcı istemcisi paylaşılır. */
export function getBrowserClient() {
  browserClient ??= createClient()
  return browserClient
}
