import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/** Giriş gerektirmeyen yollar. */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/verify',
  '/forgot-password',
  '/reset-password',
  '/paketler',
  '/gizlilik',
  '/kvkk',
  '/auth/callback',
]

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return pathname.startsWith('/api/webhooks/') || pathname.startsWith('/api/cron/')
}

export async function middleware(request: NextRequest) {
  const { user, response } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  if (isPublic(pathname)) {
    // Oturumu açık kullanıcı login/register sayfasına gelirse panele yönlendirilir.
    if (user && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return response
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar ve Next.js iç yolları hariç her istekte çalışır.
     * Böylece Supabase oturum çerezi her gezinmede tazelenir.
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|images/|.*\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webmanifest)$).*)',
  ],
}
