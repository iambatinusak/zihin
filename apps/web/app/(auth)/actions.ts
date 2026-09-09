'use server'

import { redirect } from 'next/navigation'
import { action, actionNoInput } from '@/lib/action'
import { consumeRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { AppError } from '@/lib/errors'
import { APP_URL } from '@/lib/env'
import { ROLE_HOME, isRole } from '@/lib/roles'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { findStudentByInviteCode } from '@/lib/data/auth'
import { safeRedirectOr } from './redirect'
import {
  RegisterParentSchema,
  RegisterStudentSchema,
  RequestPasswordResetSchema,
  ResendVerificationSchema,
  ResetPasswordSchema,
  SignInSchema,
} from './schemas'

/**
 * Oturumu kapatır ve giriş sayfasına yollar.
 *
 * `redirect()` bir kontrol akışı sinyali fırlatır; `action.ts` bunu bilerek
 * yeniden fırlattığı için burada try/catch yazılmaz.
 */
export const signOut = actionNoInput(async () => {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
})

/**
 * Supabase'in İngilizce hata metinleri kullanıcıya gösterilmez; bilinen
 * durumlar Türkçeye çevrilir, tanınmayanlar genel bir mesaja düşer.
 */
function authErrorMessage(message: string, fallback: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'E-posta veya şifre hatalı.'
  if (normalized.includes('email not confirmed')) {
    return 'E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin.'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin.'
  }
  if (
    normalized.includes('provider is not enabled') ||
    normalized.includes('unsupported provider')
  ) {
    return 'Google ile giriş şu anda kullanılamıyor. E-posta ve şifrenizle devam edin.'
  }
  if (normalized.includes('same password')) {
    return 'Yeni şifreniz eskisinden farklı olmalı.'
  }
  if (normalized.includes('expired') || normalized.includes('invalid token')) {
    return 'Bağlantının süresi dolmuş. Yeni bir sıfırlama bağlantısı isteyin.'
  }
  return fallback
}

/**
 * Hesap numaralandırmaya (account enumeration) karşı zaman tabanı.
 *
 * Kayıtlı bir adres için Supabase bir e-posta üretir ve şifreyi bcrypt ile
 * hash'ler; kayıtsız adres için çoğu iş atlanır. Yanıt metni aynı olsa bile
 * bu SÜRE farkı tek başına bir oracle'dır. Bu yüzden e-posta alan uçlar
 * sabit bir taban süreye yaslanır: gerçek iş daha hızlı bittiyse fark kadar
 * beklenir, daha yavaş bittiyse ek gecikme uygulanmaz.
 */
const MIN_EMAIL_ACTION_MS = 700

async function withMinimumDuration<T>(work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now()
  try {
    return await work()
  } finally {
    const remaining = MIN_EMAIL_ACTION_MS - (Date.now() - startedAt)
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}

/** Supabase'in "bu adres zaten kayıtlı" sinyalleri. Kullanıcıya ASLA yansıtılmaz. */
function isAlreadyRegistered(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('user already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('already exists')
  )
}

/** OAuth ve e-posta bağlantılarının döneceği adres. */
function callbackUrl(next?: string): string {
  const url = new URL('/auth/callback', APP_URL)
  if (next) url.searchParams.set('next', next)
  return url.toString()
}

// ---------------------------------------------------------------------------
// Giriş
// ---------------------------------------------------------------------------

/**
 * E-posta + şifre ile giriş. Yönlendirme hedefini döner; gezinmeyi istemci
 * yapar, böylece hata durumunda form yerinde kalır.
 */
export const signIn = action(SignInSchema, async (input) => {
  /*
   * Şartname §10: giriş denemesi dakikada 10 ile sınırlı.
   *
   * Anahtar e-postadır, IP değil: bir Server Action'da güvenilir istemci IP'si
   * yoktur (proxy başlıkları taklit edilebilir) ve asıl korumak istediğimiz
   * şey TEK BİR HESABA yapılan şifre denemesidir. Yan etki olarak bir
   * saldırgan başkasının hesabını kilitleyebilir; bu yüzden pencere kısa
   * (1 dk) ve hesap kalıcı olarak kilitlenmiyor.
   *
   * Sayaç e-posta var olsun olmasın aynı işler — aksi hâlde yanıt süresi
   * hesabın varlığını ele verirdi.
   */
  const limit = consumeRateLimit({
    key: `login:${input.email.trim().toLowerCase()}`,
    ...RATE_LIMITS.login,
  })

  if (!limit.allowed) {
    throw new AppError(
      'rate_limited',
      `Çok fazla giriş denemesi yapıldı. ${limit.retryAfterSeconds} saniye sonra tekrar deneyin.`,
    )
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error) {
    throw new AppError('unauthenticated', authErrorMessage(error.message, 'Giriş yapılamadı.'))
  }

  const userId = data.user?.id
  if (!userId) throw new AppError('unauthenticated', 'Giriş yapılamadı.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('id', userId)
    .maybeSingle()

  const roleValue = profile?.role
  const role = isRole(roleValue) ? roleValue : 'student'

  if (role === 'student' && profile && !profile.onboarding_completed) {
    return { redirectTo: '/onboarding' }
  }

  return { redirectTo: safeRedirectOr(input.next, ROLE_HOME[role]) }
})

// ---------------------------------------------------------------------------
// Kayıt
// ---------------------------------------------------------------------------

type SignUpMeta = Record<string, string>

/**
 * Ortak kayıt akışı. `full_name` ve `role` `options.data` ile gönderilir;
 * veritabanındaki `handle_new_user` trigger'ı profili bu meta veriden kurar.
 */
async function signUpWith(params: {
  email: string
  password: string
  fullName: string
  role: 'student' | 'parent'
  extraMeta?: SignUpMeta
}) {
  return withMinimumDuration(async () => {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        emailRedirectTo: callbackUrl('/onboarding'),
        data: {
          full_name: params.fullName,
          role: params.role,
          ...params.extraMeta,
        },
      },
    })

    if (error) {
      // GÜVENLİK: adres zaten kayıtlıysa bu SÖYLENMEZ. Aksi hâlde kayıt formu
      // bir hesap numaralandırma aracına dönerdi. Kullanıcı, adresi kayıtlıysa
      // "giriş yapın / şifrenizi sıfırlayın" bilgisini e-postayla alır —
      // Supabase kayıtlı adrese bu içerikte bir ileti gönderir.
      if (isAlreadyRegistered(error.message)) return { email: params.email }
      throw new AppError('internal', authErrorMessage(error.message, 'Kayıt tamamlanamadı.'))
    }

    const userId = data.user?.id
    // Supabase, e-posta doğrulaması açıkken var olan adres için de obfuske
    // edilmiş bir kullanıcı nesnesi döndürebilir; kimlik yoksa yine aynı
    // başarı yanıtı verilir, iç detay sızmaz.
    if (!userId) return { email: params.email }

    await storeKvkkConsent(userId)

    return { email: params.email }
  })
}

/**
 * KVKK açık rızasının verildiği anı profile yazar.
 *
 * E-posta doğrulaması açıkken `signUp` sonrası oturum oluşmaz, dolayısıyla
 * kullanıcı kendi satırını güncelleyemez; kayıt service-role ile atılır.
 * Servis anahtarı tanımlı değilse (yerel geliştirme) kayıt akışı bu yüzden
 * kırılmaz — rıza formda zaten zorunlu ve yeniden yazılabilir.
 */
async function storeKvkkConsent(userId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ kvkk_consent_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) console.error('[auth] KVKK rıza zamanı yazılamadı:', error.message)
  } catch (error) {
    console.error('[auth] KVKK rıza zamanı yazılamadı:', error)
  }
}

/** Öğrenci kaydı. */
export const registerStudent = action(RegisterStudentSchema, async (input) =>
  signUpWith({
    email: input.email,
    password: input.password,
    fullName: input.fullName,
    role: 'student',
  }),
)

/**
 * Veli kaydı. Davet kodu burada yalnızca **doğrulanır**; asıl bağ
 * (`parent_links` satırı) e-posta doğrulandıktan sonra veli akışında kurulur.
 * Kod bu yüzden `raw_user_meta_data.pending_invite_code` içinde taşınır.
 */
export const registerParent = action(RegisterParentSchema, async (input) => {
  // Davet kodu sahibi başka bir kullanıcıdır; anon oturum RLS yüzünden o satırı
  // göremez, bu yüzden doğrulama service-role istemcisiyle yapılır.
  let admin
  try {
    admin = createSupabaseAdminClient()
  } catch {
    throw new AppError(
      'internal',
      'Davet kodu şu anda doğrulanamıyor. Lütfen daha sonra tekrar deneyin.',
    )
  }

  const student = await findStudentByInviteCode(admin, input.inviteCode)
  if (!student) throw new AppError('not_found', 'Bu davet kodu bulunamadı.')

  return signUpWith({
    email: input.email,
    password: input.password,
    fullName: input.fullName,
    role: 'parent',
    extraMeta: { pending_invite_code: input.inviteCode },
  })
})

// ---------------------------------------------------------------------------
// Şifre sıfırlama
// ---------------------------------------------------------------------------

/**
 * Sıfırlama bağlantısı ister.
 *
 * GÜVENLİK: adres kayıtlı olsun ya da olmasın **aynı** sonuç döner. Aksi hâlde
 * form bir hesap numaralandırma (account enumeration) aracına dönüşür; saldırgan
 * hangi e-postaların sistemde olduğunu öğrenebilirdi. Supabase'in döndürdüğü
 * hata da bu yüzden kullanıcıya yansıtılmaz, yalnızca sunucuya loglanır.
 */
export const requestPasswordReset = action(RequestPasswordResetSchema, async (input) =>
  withMinimumDuration(async () => {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: callbackUrl('/reset-password'),
    })

    if (error) console.error('[auth] şifre sıfırlama isteği başarısız:', error.message)

    return { sent: true }
  }),
)

/** Kurtarma oturumundaki kullanıcının şifresini değiştirir. */
export const resetPassword = action(ResetPasswordSchema, async (input) => {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new AppError(
      'unauthenticated',
      'Şifre sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Yeni bir bağlantı isteyin.',
    )
  }

  const { error } = await supabase.auth.updateUser({ password: input.password })
  if (error) {
    throw new AppError('validation', authErrorMessage(error.message, 'Şifre güncellenemedi.'))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const roleValue = profile?.role
  const role = isRole(roleValue) ? roleValue : 'student'
  return { redirectTo: ROLE_HOME[role] }
})

// ---------------------------------------------------------------------------
// Doğrulama e-postası
// ---------------------------------------------------------------------------

/**
 * Doğrulama e-postasını yeniden gönderir.
 *
 * GÜVENLİK: /forgot-password ile aynı kural. Adres kayıtlı değilse ya da zaten
 * doğrulanmışsa Supabase hata döner; bu hata kullanıcıya YANSITILMAZ, yoksa uç
 * bir hesap numaralandırma aracına dönerdi. Tek istisna hız sınırı: kullanıcı
 * arka arkaya bastığında niye e-posta gelmediğini bilmeli ve bu bilgi hesabın
 * varlığı hakkında bir şey söylemez.
 */
export const resendVerification = action(ResendVerificationSchema, async (input) =>
  withMinimumDuration(async () => {
    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: input.email,
      options: { emailRedirectTo: callbackUrl('/onboarding') },
    })

    if (error) {
      const normalized = error.message.toLowerCase()
      if (normalized.includes('rate limit') || normalized.includes('too many')) {
        throw new AppError(
          'rate_limited',
          'Çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin.',
        )
      }
      console.error('[auth] doğrulama e-postası yeniden gönderilemedi:', error.message)
    }

    return { sent: true }
  }),
)
