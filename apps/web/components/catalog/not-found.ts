import { notFound } from 'next/navigation'
import { AppError } from '@/lib/errors'

/**
 * Veri katmanı "bulunamadı" derse sayfa hata ekranına düşmemeli; doğru cevap
 * 404'tür. Diğer hatalar olduğu gibi yukarı gider ve `error.tsx` yakalar.
 *
 * `Promise.catch(rethrowAsNotFound)` ile kullanılır: dönüş tipi `never`
 * olduğu için çağıran taraf değeri hâlâ tam tipli görür.
 */
export function rethrowAsNotFound(error: unknown): never {
  if (error instanceof AppError && error.code === 'not_found') notFound()
  throw error
}
