import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
import { AppError } from '@/lib/errors'

/**
 * Ayarlar sayfasının ve veli bağlantısının veri erişimi.
 *
 * Not: `lib/data/index.ts` başka bir ekip tarafından sahiplenildiği için bu
 * dosya oradan yeniden dışa aktarılmadı; `@/lib/data/settings` ile doğrudan
 * içe aktarılır.
 */

type Client = DataClient

/** Öğrencinin ayarlar sayfasında listelenen, bağlı tek veli. */
export type LinkedParent = {
  id: string
  fullName: string | null
  displayName: string | null
  avatarUrl: string | null
  linkedAt: string
}

/** Ayarlar sayfasında gösterilen abonelik özeti. */
export type SubscriptionSummary = {
  packageName: string
  endsAt: string
  /** Bugünden bitişe kalan tam gün; süresi dolmuşsa 0. */
  daysLeft: number
}

export type ProfileSettingsPatch = {
  full_name: string
  display_name: string | null
  avatar_url: string | null
  grade: Tables<'profiles'>['grade']
}

export type StudySettingsPatch = {
  exam_id: string | null
  target_exam_date: string | null
  daily_minutes: number
  study_days: number[]
}

/** Kimliği verilen kullanıcının profil alanlarını günceller. */
export async function updateProfileSettings(
  client: Client,
  userId: string,
  patch: ProfileSettingsPatch,
): Promise<void> {
  const { error } = await client.from('profiles').update(patch).eq('id', userId)
  if (error) throw new AppError('internal', 'Profil kaydedilemedi.')
}

/** Sınav ve çalışma programı tercihlerini günceller. */
export async function updateStudySettings(
  client: Client,
  userId: string,
  patch: StudySettingsPatch,
): Promise<void> {
  const { error } = await client.from('profiles').update(patch).eq('id', userId)
  if (error) throw new AppError('internal', 'Çalışma tercihleri kaydedilemedi.')
}

/** Bildirim tercihlerini bütün olarak yazar (jsonb kısmi güncellenmez). */
export async function updateNotificationPrefs(
  client: Client,
  userId: string,
  prefs: Record<string, boolean>,
): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ notification_prefs: prefs })
    .eq('id', userId)
  if (error) throw new AppError('internal', 'Bildirim tercihleri kaydedilemedi.')
}

/** Liderlik tablosu tercihini günceller. */
export async function updateLeaderboardOptIn(
  client: Client,
  userId: string,
  optIn: boolean,
): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ leaderboard_opt_in: optIn })
    .eq('id', userId)
  if (error) throw new AppError('internal', 'Tercih kaydedilemedi.')
}

/**
 * Öğrencinin aktif velilerini döner.
 *
 * İki sorgu: `profiles` okuma politikası (`can_read_student_data`) öğrenciye
 * velisinin satırını AÇMAZ, bu yüzden ad/avatar okuması service-role istemcisi
 * ister. Bağlantı listesi ise öğrencinin kendi satırlarıdır; oturum istemcisi
 * yeter. Çağıran taraf iki istemciyi de verir.
 *
 * `adminClient` null olabilir (servis anahtarı tanımlı değilse): bu durumda
 * bağlantılar yine listelenir, yalnızca ad ve avatar boş kalır — sayfanın
 * tamamının çökmesindense eksik gösterilmesi yeğdir.
 */
export async function getLinkedParents(
  client: Client,
  adminClient: Client | null,
  studentId: string,
): Promise<LinkedParent[]> {
  const { data: links, error } = await client
    .from('parent_links')
    .select('parent_id, created_at')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) throw new AppError('internal', 'Veli bağlantıları yüklenemedi.')
  if (!links || links.length === 0) return []

  if (!adminClient) {
    return links.map((link) => ({
      id: link.parent_id,
      fullName: null,
      displayName: null,
      avatarUrl: null,
      linkedAt: link.created_at,
    }))
  }

  const { data: profiles, error: profileError } = await adminClient
    .from('profiles')
    .select('id, full_name, display_name, avatar_url')
    .in(
      'id',
      links.map((link) => link.parent_id),
    )

  if (profileError) throw new AppError('internal', 'Veli profilleri yüklenemedi.')

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  return links.flatMap((link) => {
    const profile = byId.get(link.parent_id)
    if (!profile) return []
    return [
      {
        id: profile.id,
        fullName: profile.full_name,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        linkedAt: link.created_at,
      },
    ]
  })
}

/**
 * Davet kodunu taşıyan profili döner; kod eşleşmezse null.
 *
 * Service-role istemcisi zorunlu: veli, bağlanmadan önce öğrencinin satırını
 * RLS ile okuyamaz — bağ zaten yok. Yalnızca kimlik ve rol seçilir, profilin
 * geri kalanı sızdırılmaz. Kod tek kullanımlık bir sır gibi davranır.
 */
export async function findProfileByInviteCode(
  adminClient: Client,
  code: string,
): Promise<{ id: string; role: Tables<'profiles'>['role'] } | null> {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('invite_code', code)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Davet kodu doğrulanamadı.')
  return data ?? null
}

export type ParentLinkRow = Pick<Tables<'parent_links'>, 'parent_id' | 'student_id' | 'status'>

/** İki taraf arasındaki bağlantı satırını (iptal edilmiş olsa da) döner. */
export async function getParentLink(
  client: Client,
  parentId: string,
  studentId: string,
): Promise<ParentLinkRow | null> {
  const { data, error } = await client
    .from('parent_links')
    .select('parent_id, student_id, status')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Bağlantı durumu okunamadı.')
  return data ?? null
}

/**
 * Yeni bağlantı kurar. Hata mesajı çağırana ham olarak döner: 2 veli sınırını
 * zorlayan trigger'ın mesajını action katmanı Türkçeleştirerek gösterir.
 */
export async function insertParentLink(
  client: Client,
  parentId: string,
  studentId: string,
): Promise<{ errorMessage: string | null }> {
  const { error } = await client
    .from('parent_links')
    .insert({ parent_id: parentId, student_id: studentId, status: 'active' })

  return { errorMessage: error ? error.message : null }
}

/**
 * İptal edilmiş bir bağlantıyı yeniden aktifleştirir.
 *
 * Service-role istemcisi zorunlu: `parent_links_update_revoke_only` politikası
 * istemciye yalnızca 'revoked' hedefine izin verir — aksi halde veli, öğrencinin
 * kestiği bağı tek başına geri açabilirdi. Yeniden bağlanma bu yüzden sunucuda,
 * davet kodu doğrulandıktan sonra yapılır.
 */
export async function reactivateParentLink(
  adminClient: Client,
  parentId: string,
  studentId: string,
): Promise<{ errorMessage: string | null }> {
  const { error } = await adminClient
    .from('parent_links')
    .update({ status: 'active' })
    .eq('parent_id', parentId)
    .eq('student_id', studentId)

  return { errorMessage: error ? error.message : null }
}

/**
 * Bağlantıyı iptal eder. Satır silinmez, `status` 'revoked' olur: geçmişte
 * kurulmuş bir davetin izi kalsın diye (0002_identity.sql yorumu).
 */
export async function revokeParentLink(
  client: Client,
  parentId: string,
  studentId: string,
): Promise<void> {
  const { error } = await client
    .from('parent_links')
    .update({ status: 'revoked' })
    .eq('parent_id', parentId)
    .eq('student_id', studentId)

  if (error) throw new AppError('internal', 'Bağlantı kesilemedi.')
}

/**
 * Kullanıcının aktif aboneliğinin özeti; yoksa null.
 * `status` günlük bir cron ile işlendiği için bitiş tarihi ayrıca denetlenir.
 */
export async function getActiveSubscription(
  client: Client,
  userId: string,
  now: Date = new Date(),
): Promise<SubscriptionSummary | null> {
  const { data: subscription, error } = await client
    .from('subscriptions')
    .select('package_id, ends_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('ends_at', now.toISOString())
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new AppError('internal', 'Abonelik bilgisi yüklenemedi.')
  if (!subscription) return null

  const { data: pkg, error: packageError } = await client
    .from('packages')
    .select('name')
    .eq('id', subscription.package_id)
    .maybeSingle()

  if (packageError) throw new AppError('internal', 'Paket bilgisi yüklenemedi.')

  return {
    packageName: pkg?.name ?? 'Paket',
    endsAt: subscription.ends_at,
    daysLeft: daysBetween(now, new Date(subscription.ends_at)),
  }
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86_400_000)
}
