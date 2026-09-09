import type { MasteryStatus } from '@zihin/core'

/**
 * Müfredat tarayıcısının saf yardımcıları. Buradaki hiçbir fonksiyon isteğe,
 * veritabanına ya da sistem saatine bakmaz; hepsi `progress.test.ts` ile ölçülür.
 * (Uygulamaya özgü sunum mantığı olduğu için `packages/core` yerine burada durur.)
 */

/** Yetkinlik durumu "öğrenildi" sayılıyor mu? Ölçülmemiş ve zayıf konular sayılmaz. */
export function isLearned(status: MasteryStatus): boolean {
  return status === 'medium' || status === 'strong'
}

export type ProgressSummary = {
  learned: number
  total: number
  /** 0-100 arası tam sayı. Konu yoksa 0. */
  percent: number
}

/**
 * Bir dersin ilerlemesi: öğrenilmiş konu / toplam konu.
 * `statuses` yalnızca kullanıcının yetkinlik satırı bulunan konuları içerir;
 * satırı olmayan konu ölçülmemiş sayılır ve paydada kalır.
 */
export function summarizeProgress(statuses: MasteryStatus[], totalTopics: number): ProgressSummary {
  const total = Math.max(0, Math.trunc(totalTopics))
  const learned = Math.min(total, statuses.filter(isLearned).length)
  const percent = total === 0 ? 0 : Math.round((learned / total) * 100)
  return { learned, total, percent }
}

/**
 * Video süresini saat:dakika:saniye biçimine çevirir (bir saatin altında mm:ss).
 * Geçersiz ya da negatif değerler 0 sayılır.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.trunc(totalSeconds) : 0
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/**
 * Konu içeriği kilitli mi?
 * Aboneliği olan kullanıcı için hiçbir şey kilitli değildir. Aboneliği
 * olmayan kullanıcı yalnızca ücretsiz önizleme işaretli içeriği görebilir;
 * hiç içerik yoksa kilit değil, "hazırlanıyor" durumu gösterilir.
 */
export function isContentLocked(input: {
  hasSubscription: boolean
  hasContent: boolean
  hasFreePreview: boolean
}): boolean {
  if (input.hasSubscription) return false
  if (!input.hasContent) return false
  return !input.hasFreePreview
}

/** `subjects.color` bir HSL üçlüsüdür ("217 91% 60%"). Bozuk değerler yerine null döner. */
export function parseSubjectColor(color: string | null): string | null {
  if (!color) return null
  const trimmed = color.trim()
  return /^\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%$/.test(trimmed) ? trimmed : null
}
