import { AppError } from '@/lib/errors'

/**
 * `questions` üzerindeki veritabanı kısıtlarının Türkçe karşılıkları.
 *
 * Uygulama katmanı aynı kuralları zaten denetliyor (Zod + `validateOptions`),
 * ama son sözü veritabanı söylüyor: `validate_question_options()` trigger'ı
 * (0004) doğru şık şıklar arasında değilse kaydı reddeder. O mesaj aksansız ve
 * Postgres diliyle yazılmıştır ("Dogru secenek "C" siklar arasinda
 * bulunamadi."); kullanıcıya ham hâliyle GİTMEZ.
 */

type PostgrestLikeError = { message?: string | null; code?: string | null; details?: string | null }

function textOf(error: PostgrestLikeError | null | undefined): string {
  return `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase()
}

/** `validate_question_options()` trigger'ına takılan hata mı? */
export function isCorrectOptionError(error: PostgrestLikeError | null | undefined): boolean {
  const text = textOf(error)
  return text.includes('siklar arasinda bulunamadi') || text.includes('dogru secenek')
}

/** Şık sayısı / tür kısıtına takılan hata mı? */
export function isOptionsShapeError(error: PostgrestLikeError | null | undefined): boolean {
  const text = textOf(error)
  return (
    text.includes('questions_options_check') ||
    text.includes('bir json dizisi olmalidir') ||
    text.includes('siklar (options)')
  )
}

export function isDifficultyError(error: PostgrestLikeError | null | undefined): boolean {
  return textOf(error).includes('questions_difficulty_check')
}

export function isExpectedSecondsError(error: PostgrestLikeError | null | undefined): boolean {
  return textOf(error).includes('questions_expected_seconds_check')
}

/**
 * Bir Postgrest hatasını gösterilebilir `AppError`a çevirir.
 * Tanınmayan hata `internal` döner; iç detay istemciye sızmaz.
 */
export function toQuestionAppError(
  error: PostgrestLikeError | null | undefined,
  fallbackMessage: string,
): AppError {
  if (isCorrectOptionError(error)) {
    return new AppError('validation', 'Doğru şık, şıklar arasında bulunamadı.', {
      correctOption: ['Doğru şık, girdiğiniz şıklardan biri olmalı.'],
    })
  }

  if (isOptionsShapeError(error)) {
    return new AppError('validation', 'Şıklar geçerli değil.', {
      options: ['Soru 2 ile 5 arasında şık içermeli.'],
    })
  }

  if (isDifficultyError(error)) {
    return new AppError('validation', 'Zorluk geçerli değil.', {
      difficulty: ['Zorluk 1 ile 5 arasında olmalı.'],
    })
  }

  if (isExpectedSecondsError(error)) {
    return new AppError('validation', 'Beklenen süre geçerli değil.', {
      expectedSeconds: ['Beklenen süre pozitif bir tam sayı olmalı.'],
    })
  }

  console.error('[admin-questions] veritabanı hatası:', error)
  return new AppError('internal', fallbackMessage)
}

/** Toplu içe aktarmada satır raporuna yazılacak kısa Türkçe mesaj. */
export function importRowMessage(error: PostgrestLikeError | null | undefined): string {
  if (isCorrectOptionError(error)) return 'Doğru şık, şıklar arasında bulunamadı.'
  if (isOptionsShapeError(error)) return 'Şıklar 2 ile 5 arasında olmalı.'
  if (isDifficultyError(error)) return 'Zorluk 1 ile 5 arasında olmalı.'
  if (isExpectedSecondsError(error)) return 'Beklenen süre pozitif bir tam sayı olmalı.'
  return 'Bu satır kaydedilemedi.'
}
