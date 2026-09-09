import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ROLE_HOME, isRole } from '@/lib/roles'
import { isSafeRedirect } from '@/app/(auth)/redirect'

/**
 * E-posta doğrulama, şifre kurtarma ve OAuth dönüşlerinin ortak durağı.
 *
 * `(auth)` grubunun **dışında** durur; rota grubu URL'ye yansımadığı için
 * dosyanın gerçek yolu `/auth/callback` olmalıdır. `middleware.ts` içindeki
 * PUBLIC_PATHS listesinde bu yol zaten tanımlı.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  const loginWithError = () => NextResponse.redirect(new URL('/login?error=callback', origin))

  if (!code) return loginWithError()

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) return loginWithError()

  // Şifre sıfırlama gibi akışlar kendi hedeflerini taşır; hedef yalnızca
  // uygulama içi bir yolsa kabul edilir (açık yönlendirme koruması).
  if (isSafeRedirect(next)) {
    return NextResponse.redirect(new URL(next as string, origin))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('id', data.user.id)
    .maybeSingle()

  // Profil trigger'la oluşur; bir gecikme olursa kullanıcıyı başlangıca yolla.
  if (!profile || !profile.onboarding_completed) {
    return NextResponse.redirect(new URL('/onboarding', origin))
  }

  const role = isRole(profile.role) ? profile.role : 'student'
  return NextResponse.redirect(new URL(ROLE_HOME[role], origin))
}
