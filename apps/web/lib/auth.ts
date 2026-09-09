import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { ROLE_HOME, type Role } from '@/lib/roles'

export type SessionProfile = {
  id: string
  role: Role
  fullName: string | null
  displayName: string | null
  avatarUrl: string | null
  grade: string | null
  examId: string | null
  targetExamDate: string | null
  dailyMinutes: number
  studyDays: number[]
  inviteCode: string | null
  onboardingCompleted: boolean
  leaderboardOptIn: boolean
  xp: number
  level: number
  currentStreak: number
  email: string
  emailVerified: boolean
  /** Yönetici hesabı askıya aldıysa dolu. Dolu olduğu sürece uygulama kullanılamaz. */
  suspendedAt: string | null
}

/**
 * Oturumdaki kullanıcıyı ve profilini getirir.
 * `cache()` sayesinde aynı render içinde tekrar tekrar sorgulanmaz.
 */
export const getCurrentUser = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, role, full_name, display_name, avatar_url, grade, exam_id, target_exam_date, daily_minutes, study_days, invite_code, onboarding_completed, leaderboard_opt_in, xp, level, current_streak, suspended_at',
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return null

  const p = profile as Record<string, unknown>

  return {
    id: user.id,
    role: p.role as Role,
    fullName: (p.full_name as string) ?? null,
    displayName: (p.display_name as string) ?? null,
    avatarUrl: (p.avatar_url as string) ?? null,
    grade: (p.grade as string) ?? null,
    examId: (p.exam_id as string) ?? null,
    targetExamDate: (p.target_exam_date as string) ?? null,
    dailyMinutes: (p.daily_minutes as number) ?? 60,
    studyDays: (p.study_days as number[]) ?? [1, 2, 3, 4, 5, 6],
    inviteCode: (p.invite_code as string) ?? null,
    onboardingCompleted: Boolean(p.onboarding_completed),
    leaderboardOptIn: p.leaderboard_opt_in !== false,
    xp: (p.xp as number) ?? 0,
    level: (p.level as number) ?? 1,
    currentStreak: (p.current_streak as number) ?? 0,
    email: user.email ?? '',
    emailVerified: Boolean(user.email_confirmed_at),
    suspendedAt: (p.suspended_at as string) ?? null,
  }
})

/**
 * Askıya alınmış hesap uygulamayı kullanamaz (spec §M15).
 *
 * Denetim OTURUM ÇÖZÜMLEMESİNİN İÇİNDE, iki kapıda birden: sayfa tarafında
 * `requireUser` yönlendirir, action tarafında `assertRole` fırlatır. Tek bir
 * yere konsaydı diğer taraf açık kalırdı — Server Action herkese açık bir uç
 * noktadır, sayfayı gizlemek onu korumaz (CONVENTIONS §3).
 *
 * `getCurrentUser` bilerek `null` DÖNMÜYOR: askıdaki kullanıcının kim olduğu
 * bilinmezse ne doğru mesaj gösterilebilir ne de çıkış yapabilir.
 */
const SUSPENDED_MESSAGE =
  'Hesabınız askıya alındı. Devam etmek için destek ekibiyle iletişime geçin.'

/** Giriş zorunlu. Oturum yoksa /login sayfasına yönlendirir. */
export async function requireUser(returnTo?: string): Promise<SessionProfile> {
  const user = await getCurrentUser()
  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login'
    redirect(target)
  }
  if (user.suspendedAt !== null) redirect('/hesap-askida')
  return user
}

/**
 * Belirli rol(ler) zorunlu. Rol uymuyorsa kullanıcıyı kendi ana sayfasına yollar.
 * Sayfalarda (RSC) kullanılır.
 */
export async function requireRole(
  roles: Role | Role[],
  options: { returnTo?: string } = {},
): Promise<SessionProfile> {
  const allowed = Array.isArray(roles) ? roles : [roles]
  const user = await requireUser(options.returnTo)

  if (!allowed.includes(user.role)) {
    redirect(ROLE_HOME[user.role])
  }
  return user
}

/**
 * Server Action'lar için rol denetimi. Yönlendirme yapmaz, hata fırlatır —
 * çağıran taraf `action()` sarmalayıcısıyla (lib/action.ts) bunu ActionResult'a çevirir.
 */
export async function assertRole(roles: Role | Role[]): Promise<SessionProfile> {
  const allowed = Array.isArray(roles) ? roles : [roles]
  const user = await getCurrentUser()

  if (!user) throw new AppError('unauthenticated', 'Bu işlem için giriş yapmalısınız.')
  if (user.suspendedAt !== null) throw new AppError('forbidden', SUSPENDED_MESSAGE)
  if (!allowed.includes(user.role)) {
    throw new AppError('forbidden', 'Bu işlem için yetkiniz yok.')
  }
  return user
}

/** Başlangıç adımlarını tamamlamış öğrenci zorunlu. */
export async function requireOnboardedStudent(returnTo?: string): Promise<SessionProfile> {
  const user = await requireRole('student', { returnTo })
  if (!user.onboardingCompleted) redirect('/onboarding')
  return user
}
