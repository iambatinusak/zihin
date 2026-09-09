import { isSessionResumable } from '@/lib/test-engine/session'

/**
 * Bir denemenin kullanıcı açısından durumu (ekran §9.12).
 *
 * Saf: "şimdi" parametre olarak gelir. Oturum listesi çağıran tarafından
 * verilir; burada veritabanına gidilmez.
 */

export type MockSessionLike = {
  id: string
  finished_at: string | null
  expires_at: string
  started_at: string
}

export type MockAttemptState =
  /** Hiç başlanmamış ya da yalnızca süresi dolmuş bir denemesi var. */
  | { kind: 'not_started' }
  /** Yarım kalmış, süresi dolmamış oturum — "devam et". */
  | { kind: 'in_progress'; sessionId: string; startedAt: string }
  /** Bitirilmiş — son bitirilen oturum gösterilir. */
  | { kind: 'finished'; sessionId: string; finishedAt: string }

/**
 * Denemenin durumu.
 *
 * ÖNCELİK: sürdürülebilir bir oturum, bitmiş bir oturumdan ÖNCE gelir. Bir
 * öğrenci denemeyi bitirip yeniden başlatmışsa ekranda görmesi gereken şey
 * yarım kalan yeni oturumdur, eski sonucu değil.
 *
 * Süresi dolmuş ve bitmemiş bir oturum yok sayılır: ondan geriye çözülecek bir
 * şey kalmamıştır, "çözülmedi" doğru cevaptır.
 */
export function mockAttemptState(
  sessions: readonly MockSessionLike[],
  now: Date,
): MockAttemptState {
  let resumable: MockSessionLike | null = null
  let finished: { id: string; finishedAt: string } | null = null

  for (const session of sessions) {
    const finishedAt = session.finished_at
    if (finishedAt !== null) {
      // ISO 8601 damgaları sözlüksel olarak da kronolojik sıralanır.
      if (finished === null || finishedAt > finished.finishedAt) {
        finished = { id: session.id, finishedAt }
      }
      continue
    }
    if (!isSessionResumable(session, now)) continue
    if (resumable === null || session.started_at > resumable.started_at) resumable = session
  }

  if (resumable !== null) {
    return { kind: 'in_progress', sessionId: resumable.id, startedAt: resumable.started_at }
  }
  if (finished !== null) {
    return { kind: 'finished', sessionId: finished.id, finishedAt: finished.finishedAt }
  }
  return { kind: 'not_started' }
}
