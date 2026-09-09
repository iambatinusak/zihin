import { z } from 'zod'

/**
 * Ortam değişkenleri tek noktadan, şema ile doğrulanır.
 * Eksik ya da hatalı bir değişken, uygulama ayağa kalkarken net bir hata verir;
 * çalışma anında "undefined" sürprizleri olmaz.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('Zihin'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_BRAND_HUE: z.coerce.number().min(0).max(360).default(243),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_DB_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Zihin <bilgi@example.com>'),
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().default('https://sandbox-api.iyzipay.com'),
  VIDEO_PROVIDER: z.enum(['supabase', 'bunny']).default('supabase'),
  SUPABASE_VIDEO_BUCKET: z.string().default('videos'),
  BUNNY_LIBRARY_ID: z.string().optional(),
  BUNNY_API_KEY: z.string().optional(),
  BUNNY_PULL_ZONE: z.string().optional(),
  BUNNY_TOKEN_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
})

/**
 * Next.js istemci paketine yalnızca açıkça yazılmış `process.env.NEXT_PUBLIC_*`
 * ifadelerini gömer; bu yüzden değerleri tek tek yazmak zorundayız.
 */
function readPublic() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BRAND_HUE: process.env.NEXT_PUBLIC_BRAND_HUE,
  })

  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(
      `Ortam değişkenleri eksik veya geçersiz: ${missing}. ` +
        `.env.example dosyasını .env.local olarak kopyalayıp doldurun.`,
    )
  }
  return parsed.data
}

let cachedPublic: z.infer<typeof publicSchema> | null = null
export function publicEnv() {
  cachedPublic ??= readPublic()
  return cachedPublic
}

let cachedServer: z.infer<typeof serverSchema> | null = null
/** Yalnızca sunucu tarafında çağırın. */
export function serverEnv() {
  cachedServer ??= serverSchema.parse(process.env)
  return cachedServer
}

/** Kullanıcıya görünen marka adı. İstemci ve sunucuda aynı değeri verir. */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Zihin'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
export const BRAND_HUE = Number(process.env.NEXT_PUBLIC_BRAND_HUE || 243)
