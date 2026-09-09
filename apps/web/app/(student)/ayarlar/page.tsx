import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { AccountCard } from '@/components/settings/account-card'
import { InviteCard, type LinkedParentView } from '@/components/settings/invite-card'
import { LeaderboardForm } from '@/components/settings/leaderboard-form'
import { NotificationForm } from '@/components/settings/notification-form'
import { ProfileForm } from '@/components/settings/profile-form'
import { SettingsNav } from '@/components/settings/settings-nav'
import { SettingsSection } from '@/components/settings/settings-section'
import { StudyForm } from '@/components/settings/study-form'
import { SubscriptionCard } from '@/components/settings/subscription-card'
import { requireOnboardedStudent } from '@/lib/auth'
import { getActiveExams } from '@/lib/data/catalog'
import { getActiveSubscription, getLinkedParents } from '@/lib/data/settings'
import { getProfile } from '@/lib/data/profile'
import { section, t } from '@/lib/i18n'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseNotificationPrefs, type Grade } from './schemas'

export const metadata: Metadata = { title: 'Ayarlar' }

const s = section<{
  title: string
  description: string
  profile: Record<string, string>
  study: Record<string, string>
  notifications: Record<string, string>
  leaderboard: Record<string, string>
  subscription: Record<string, string>
  account: Record<string, string>
}>('settings')

function tryAdminClient() {
  try {
    return createSupabaseAdminClient()
  } catch {
    return null
  }
}

/**
 * Ayarlar tek sayfada, bölüm bölüm. Yetki denetimi düzende (`(student)/layout`)
 * yapılır; burada tekrar edilmez (CONVENTIONS §3).
 */
export default async function SettingsPage() {
  const user = await requireOnboardedStudent('/ayarlar')
  const supabase = await createSupabaseServerClient()

  const profile = await getProfile(supabase, user.id)

  // Veli adları RLS ile öğrenciye kapalı; service-role istemcisi yalnızca bu
  // okuma için ve oturumdan gelen kimlikle kullanılır (CONVENTIONS §4).
  // Anahtar tanımlı değilse sayfa çökmez: adlar boş listelenir.
  const admin = tryAdminClient()

  const [exams, parents, subscription] = await Promise.all([
    getActiveExams(supabase),
    getLinkedParents(supabase, admin, user.id),
    getActiveSubscription(supabase, user.id),
  ])

  const parentViews: LinkedParentView[] = parents.map((parent) => ({
    id: parent.id,
    name: parent.displayName?.trim() || parent.fullName?.trim() || t('link.nameless'),
    avatarUrl: parent.avatarUrl,
    linkedAt: parent.linkedAt,
  }))

  const navItems = [
    { id: 'profil', label: t('settings.profile.title') },
    { id: 'sinav-program', label: t('settings.study.title') },
    { id: 'veli-daveti', label: t('link.title') },
    { id: 'bildirimler', label: t('settings.notifications.title') },
    { id: 'liderlik', label: t('settings.leaderboard.title') },
    { id: 'abonelik', label: t('settings.subscription.title') },
    { id: 'hesap', label: t('settings.account.title') },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={s.title} description={s.description} />

      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
        <SettingsNav items={navItems} />

        <div className="space-y-6">
          <SettingsSection
            id="profil"
            title={t('settings.profile.title')}
            description={s.profile.description}
          >
            <ProfileForm
              fullName={profile.full_name ?? ''}
              displayName={profile.display_name ?? ''}
              avatarUrl={profile.avatar_url ?? ''}
              grade={(profile.grade as Grade | null) ?? null}
            />
          </SettingsSection>

          <SettingsSection
            id="sinav-program"
            title={t('settings.study.title')}
            description={s.study.description}
          >
            <StudyForm
              exams={exams.map((exam) => ({ id: exam.id, name: exam.name }))}
              examId={profile.exam_id ?? ''}
              targetExamDate={profile.target_exam_date ?? ''}
              dailyMinutes={profile.daily_minutes}
              studyDays={profile.study_days}
            />
          </SettingsSection>

          <SettingsSection
            id="veli-daveti"
            title={t('link.title')}
            description={t('link.description')}
          >
            <InviteCard inviteCode={profile.invite_code} parents={parentViews} />
          </SettingsSection>

          <SettingsSection
            id="bildirimler"
            title={t('settings.notifications.title')}
            description={s.notifications.description}
          >
            <NotificationForm initial={parseNotificationPrefs(profile.notification_prefs)} />
          </SettingsSection>

          <SettingsSection
            id="liderlik"
            title={t('settings.leaderboard.title')}
            description={s.leaderboard.description}
          >
            <LeaderboardForm initial={profile.leaderboard_opt_in} />
          </SettingsSection>

          <SettingsSection
            id="abonelik"
            title={t('settings.subscription.title')}
            description={s.subscription.description}
          >
            <SubscriptionCard subscription={subscription} />
          </SettingsSection>

          <SettingsSection
            id="hesap"
            title={t('settings.account.title')}
            description={s.account.description}
          >
            <AccountCard email={user.email} />
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
