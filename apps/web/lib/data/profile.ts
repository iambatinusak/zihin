import 'server-only'

import type { Tables } from '@zihin/db/types'
import type { DataClient } from './client'
import { AppError } from '@/lib/errors'

/**
 * Profil ve veli-öğrenci bağı okumaları.
 */

type Client = DataClient

export type Profile = Tables<'profiles'>

/** Veli panelinde listelenen, bağı aktif tek öğrenci. */
export type LinkedStudent = {
  id: string
  fullName: string | null
  displayName: string | null
  avatarUrl: string | null
  grade: Profile['grade']
  examId: string | null
  xp: number
  level: number
  currentStreak: number
  linkedAt: string
}

/**
 * Kimliği verilen kullanıcının profilini döner.
 * Profil yoksa `not_found` hatası fırlatır.
 */
export async function getProfile(client: Client, userId: string): Promise<Profile> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) throw new AppError('internal', 'Profil yüklenemedi.')
  if (!data) throw new AppError('not_found', 'Profil bulunamadı.')
  return data
}

/**
 * Velinin bağlı olduğu öğrencileri döner; yalnızca bağı "active" olanlar gelir.
 * Bağ yoksa boş dizi döner — bu bir hata değildir.
 */
export async function getLinkedStudents(
  client: Client,
  parentId: string,
): Promise<LinkedStudent[]> {
  const { data: links, error } = await client
    .from('parent_links')
    .select('student_id, created_at')
    .eq('parent_id', parentId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) throw new AppError('internal', 'Öğrenci bağlantıları yüklenemedi.')
  if (!links || links.length === 0) return []

  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select('id, full_name, display_name, avatar_url, grade, exam_id, xp, level, current_streak')
    .in(
      'id',
      links.map((link) => link.student_id),
    )

  if (profileError) throw new AppError('internal', 'Öğrenci profilleri yüklenemedi.')

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  return links.flatMap((link) => {
    const profile = byId.get(link.student_id)
    if (!profile) return []
    return [
      {
        id: profile.id,
        fullName: profile.full_name,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        grade: profile.grade,
        examId: profile.exam_id,
        xp: profile.xp,
        level: profile.level,
        currentStreak: profile.current_streak,
        linkedAt: link.created_at,
      },
    ]
  })
}
