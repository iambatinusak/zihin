import { serverEnv } from '@/lib/env'
import { createIyzicoBillingProvider } from './iyzico-provider'
import { createMockBillingProvider } from './mock-provider'
import {
  selectBillingProviderName,
  type BillingProvider,
  type BillingProviderName,
} from './provider'

export type {
  BillingProvider,
  BillingProviderName,
  CheckoutRequest,
  CheckoutSession,
  PaymentVerification,
} from './provider'
export { BILLING_CURRENCY, selectBillingProviderName } from './provider'

/**
 * Yürürlükteki ödeme sağlayıcısını döner (lib/video/index.ts ile aynı biçim).
 * Seçim kuralı `provider.ts` içindeki `selectBillingProviderName`dedir.
 */
const FACTORIES: Record<BillingProviderName, () => BillingProvider> = {
  iyzico: () => createIyzicoBillingProvider(),
  mock: createMockBillingProvider,
}

export function getBillingProvider(): BillingProvider {
  const name = selectBillingProviderName(serverEnv().IYZICO_API_KEY)
  return FACTORIES[name]()
}

/** Arayüzün "bu bir test ödemesidir" bandını göstermesi için. */
export function isMockBilling(): boolean {
  return selectBillingProviderName(serverEnv().IYZICO_API_KEY) === 'mock'
}
