import { AppError } from '@/lib/errors'

/**
 * Veritabanı kısıtlarının Türkçe karşılıkları.
 *
 * `help_messages` üzerindeki 5 mesaj sınırı (0007) ve `body/image_url` boşluk
 * kısıtı (0007) uygulamada da denetleniyor; ama veritabanı son sözü söyleyen
 * taraf ve yarış durumunda (aynı anda iki mesaj) yalnızca o yakalar. O zaman
 * kullanıcıya "Beklenmeyen bir hata oluştu" demek yerine kısıtın gerçek
 * anlamını söyleriz.
 */

/** Bir soru altında gönderilebilecek en fazla mesaj (0007'deki trigger ile aynı). */
export const MAX_MESSAGES_PER_REQUEST = 5

type PostgrestLikeError = { message?: string | null; code?: string | null }

/** Konuşma sınırına takılan hata mı? */
export function isMessageLimitError(error: PostgrestLikeError | null | undefined): boolean {
  const message = (error?.message ?? '').toLowerCase()
  return message.includes('en fazla 5 mesaj')
}

/** "Metin de görsel de boş" kısıtına takılan hata mı? */
export function isBodyOrImageError(error: PostgrestLikeError | null | undefined): boolean {
  const message = error?.message ?? ''
  return message.includes('body_image_url_check')
}

/**
 * Bir Postgrest hatasını kullanıcıya gösterilebilir `AppError`a çevirir.
 * Tanınmayan hata `internal` olarak döner; iç detay istemciye sızmaz.
 */
export function toHelpAppError(
  error: PostgrestLikeError | null | undefined,
  fallbackMessage: string,
): AppError {
  if (isMessageLimitError(error)) {
    return new AppError(
      'conflict',
      'Bu soru altında en fazla 5 mesaj gönderilebilir. Yeni bir soru sorabilirsiniz.',
    )
  }

  if (isBodyOrImageError(error)) {
    return new AppError('validation', 'En az bir alan dolu olmalı.', {
      body: ['Bir açıklama yazın ya da fotoğraf ekleyin.'],
    })
  }

  console.error('[help] veritabanı hatası:', error)
  return new AppError('internal', fallbackMessage)
}
