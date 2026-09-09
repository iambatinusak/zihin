import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@zihin/db/types'

/**
 * Veri katmanı fonksiyonlarının ilk parametresi.
 * RSC/action istemcisi de service-role istemcisi de bu tipe uyar; testler
 * yerine sahte bir nesne geçirebilir.
 */
export type DataClient = SupabaseClient<Database>
