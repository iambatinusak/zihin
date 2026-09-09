'use server'

import { revalidatePath } from 'next/cache'
import { action } from '@/lib/action'
import { assertRole } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  findProfileByInviteCode,
  getParentLink,
  insertParentLink,
  reactivateParentLink,
  revokeParentLink,
  updateLeaderboardOptIn as writeLeaderboardOptIn,
  updateNotificationPrefs as writeNotificationPrefs,
  updateProfileSettings as writeProfileSettings,
  updateStudySettings as writeStudySettings,
} from '@/lib/data/settings'
import {
  InviteCodeSchema,
  LeaderboardOptInSchema,
  NotificationPrefsSchema,
  ProfileSettingsSchema,
  StudySettingsSchema,
  UnlinkParentSchema,
} from './schemas'

/**
 * Ayarlar ve veli bağlantısı mutasyonları.
 *
 * Yetki denetimi sayfada değil burada da yapılır: bir Server Action doğrudan
 * çağrılabilir, düzenin guard'ı onu korumaz (CONVENTIONS §3).
 */

/** Profil bilgileri: ad soyad, görünen ad, avatar, sınıf. */
export const updateProfile = action(ProfileSettingsSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  await writeProfileSettings(supabase, user.id, {
    full_name: input.fullName,
    display_name: input.displayName,
    avatar_url: input.avatarUrl,
    grade: input.grade,
  })

  // Ad ve avatar üst çubukta görünüyor; tüm düzen tazelenmeli.
  revalidatePath('/', 'layout')
  return { saved: true }
})

/**
 * Sınav ve program tercihleri.
 *
 * Bu action programı YENİDEN ÜRETMEZ, yalnızca tercihi saklar. Üretim ya
 * haftalık cron'da (`/api/cron/weekly-plans`, Pazar 03:00) ya da öğrencinin
 * `/program` sayfasındaki `regeneratePlan` çağrısıyla olur; ikisi de tercihi
 * o an okur. Kullanıcıya giden karşılığı `settings.study.planNote`.
 */
export const updateStudyPreferences = action(StudySettingsSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  await writeStudySettings(supabase, user.id, {
    exam_id: input.examId,
    target_exam_date: input.targetExamDate,
    daily_minutes: input.dailyMinutes,
    study_days: input.studyDays,
  })

  revalidatePath('/ayarlar')
  revalidatePath('/program')
  revalidatePath('/dashboard')
  return { saved: true }
})

/** Bildirim tercihleri; jsonb alan bütün olarak yazılır. */
export const updateNotificationPreferences = action(NotificationPrefsSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  await writeNotificationPrefs(supabase, user.id, {
    email_reminders: input.email_reminders,
    email_weekly_summary: input.email_weekly_summary,
    app_notifications: input.app_notifications,
  })

  revalidatePath('/ayarlar')
  return { saved: true }
})

/** Liderlik tablosunda görünme tercihi. */
export const updateLeaderboardOptIn = action(LeaderboardOptInSchema, async (input) => {
  const user = await assertRole('student')
  const supabase = await createSupabaseServerClient()

  await writeLeaderboardOptIn(supabase, user.id, input.optIn)

  revalidatePath('/ayarlar')
  revalidatePath('/rozetler')
  return { optIn: input.optIn }
})

/**
 * Veli, öğrencinin davet kodunu girerek bağlantı kurar.
 *
 * Kod doğrulaması service-role ile yapılır: veli, bağ kurulmadan önce
 * öğrencinin profil satırını RLS ile okuyamaz. Kayıt (insert) ise oturum
 * istemcisiyle yazılır — böylece hem `parent_links_insert_parent` politikası
 * hem de 2 veli sınırını zorlayan trigger devrede kalır.
 */
export const linkParentByInviteCode = action(InviteCodeSchema, async (input) => {
  const parent = await assertRole('parent')
  const supabase = await createSupabaseServerClient()
  const admin = requireAdminClient()

  const target = await findProfileByInviteCode(admin, input.code)
  if (!target) throw new AppError('not_found', 'Bu davet kodu bulunamadı.')

  if (target.id === parent.id) {
    throw new AppError('conflict', 'Kendi davet kodunuzla bağlantı kuramazsınız.')
  }
  if (target.role !== 'student') {
    throw new AppError('conflict', 'Bu davet kodu bir öğrenciye ait değil.')
  }

  const existing = await getParentLink(supabase, parent.id, target.id)

  if (existing?.status === 'active') {
    throw new AppError('conflict', 'Bu öğrenciyle bağlantınız zaten var.')
  }

  const result = existing
    ? // Daha önce kesilmiş bağ: politika istemciye yeniden aktifleştirmeyi
      // kapatır, bu yüzden kod doğrulandıktan sonra sunucuda açılır.
      await reactivateParentLink(admin, parent.id, target.id)
    : await insertParentLink(supabase, parent.id, target.id)

  if (result.errorMessage) throw toLinkError(result.errorMessage)

  revalidatePath('/veli')
  revalidatePath('/veli/ogrenciler')
  revalidatePath('/ayarlar')
  return { studentId: target.id }
})

/**
 * Bağlantıyı keser. İki taraf da çağırabilir (RLS
 * `parent_links_delete_either_side` / `..._update_revoke_only`): öğrenci için
 * bu, KVKK kapsamındaki açık rızanın geri çekilmesidir — velinin erişimi
 * anında biter. Veli için ise kendi isteğiyle takibi bırakmasıdır.
 *
 * İstemci yalnızca karşı tarafın kimliğini gönderir; kendi tarafı oturumdan
 * okunur, böylece başkasının bağlantısı kesilemez.
 */
export const unlinkParent = action(UnlinkParentSchema, async (input) => {
  const user = await assertRole(['student', 'parent'])
  const supabase = await createSupabaseServerClient()

  const parentId = user.role === 'parent' ? user.id : input.parentId
  const studentId = user.role === 'student' ? user.id : input.studentId

  if (!parentId || !studentId) {
    throw new AppError('validation', 'Bağlantısı kesilecek kişi belirtilmedi.')
  }

  const existing = await getParentLink(supabase, parentId, studentId)
  if (!existing || existing.status !== 'active') {
    throw new AppError('not_found', 'Aktif bir bağlantı bulunamadı.')
  }

  await revokeParentLink(supabase, parentId, studentId)

  revalidatePath('/ayarlar')
  revalidatePath('/veli')
  revalidatePath('/veli/ogrenciler')
  return { parentId, studentId }
})

/**
 * Veritabanından gelen ham hatayı kullanıcıya gösterilebilir hâle çevirir.
 * 2 veli sınırı bir trigger mesajıdır (0002_identity.sql); genel "beklenmeyen
 * hata" yerine kuralın kendisi gösterilir.
 */
/**
 * Davet kodu doğrulaması service-role gerektirir. Anahtar yoksa kullanıcıya
 * ham ortam hatası değil, anlaşılır bir mesaj gider.
 */
function requireAdminClient() {
  try {
    return createSupabaseAdminClient()
  } catch (error) {
    console.error('[linkParentByInviteCode] servis anahtarı eksik:', error)
    throw new AppError('internal', 'Bağlantı şu anda kurulamıyor. Lütfen daha sonra deneyin.')
  }
}

function toLinkError(message: string): AppError {
  if (message.includes('en fazla 2 veli')) {
    return new AppError('conflict', 'Bir öğrenciye en fazla 2 veli bağlanabilir.')
  }
  // Aynı çiftin ikinci kez eklenmesi (birincil anahtar çakışması).
  if (message.includes('duplicate key')) {
    return new AppError('conflict', 'Bu öğrenciyle bağlantınız zaten var.')
  }
  if (message.includes('row-level security')) {
    return new AppError('forbidden', 'Bu işlem için yetkiniz yok.')
  }

  console.error('[linkParentByInviteCode] beklenmeyen veritabanı hatası:', message)
  return new AppError('internal', 'Bağlantı kurulamadı. Lütfen tekrar deneyin.')
}
