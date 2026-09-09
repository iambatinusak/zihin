import { z } from 'zod'

/**
 * Ödeme akışının Server Action girdileri.
 *
 * ── ŞEMADA FİYAT ALANI YOKTUR VE OLMAYACAKTIR ──────────────────────────────
 * `createCheckout` yalnızca bir paket kimliği alır. Tutar sunucuda
 * `packages.price_try` kolonundan okunur (lib/data/billing.ts →
 * `getPurchasablePackage`).
 *
 * Zod tanımsız anahtarları SESSİZCE DÜŞÜRÜR: istemci gövdeye `price`,
 * `amount`, `discount` ya da `durationDays` koysa bile `parsed.data` içine
 * girmez, dolayısıyla hiçbir kod yolu onu göremez. Bu davranış
 * `schemas.test.ts` içinde açıkça test edilir — bir gün biri `.passthrough()`
 * eklerse test kırılsın.
 *
 * Şemalar ayrı dosyada: `actions.ts` `'use server'` taşıdığı için oradan
 * yalnızca `async` fonksiyon dışa aktarılabilir.
 */

const Uuid = z.string().uuid({ message: 'Geçersiz paket kimliği.' })

/** Ödeme oturumu açar. TEK girdi paket kimliğidir. */
export const CreateCheckoutSchema = z.object({ packageId: Uuid })

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>
