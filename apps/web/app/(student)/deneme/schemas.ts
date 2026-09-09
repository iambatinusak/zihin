import { z } from 'zod'

/**
 * Deneme sınavı Server Action girdileri.
 *
 * Şemalar ayrı dosyada: `actions.ts` `'use server'` taşıdığı için oradan
 * yalnızca `async` fonksiyon dışa aktarılabilir.
 */

const Uuid = z.string().uuid({ message: 'Geçersiz kayıt kimliği.' })

/** Denemeyi başlatır ya da yarım kalanı sürdürür. */
export const StartMockSchema = z.object({ testId: Uuid })

/** Deneme sonucunu okur. */
export const GetMockResultSchema = z.object({ sessionId: Uuid })
