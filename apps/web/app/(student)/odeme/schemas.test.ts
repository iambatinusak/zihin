import { describe, expect, it } from 'vitest'
import { CreateCheckoutSchema } from './schemas'

const PACKAGE_ID = '11111111-2222-3333-4444-555555555555'

/**
 * PARANIN BİRİNCİ KURALI: fiyat istemciden gelmez.
 *
 * Bu testler şemanın kapısını tutuyor. Biri `price` alanını şemaya eklerse ya
 * da `.passthrough()` yazarsa burası kırılır — ve kırılması gerekir.
 */
describe('CreateCheckoutSchema', () => {
  it('yalnızca paket kimliğini kabul eder', () => {
    const parsed = CreateCheckoutSchema.parse({ packageId: PACKAGE_ID })
    expect(parsed).toEqual({ packageId: PACKAGE_ID })
  })

  it('uydurulmuş fiyat alanlarını çıktıya ALMAZ', () => {
    const crafted = {
      packageId: PACKAGE_ID,
      price: 1,
      priceTry: 1,
      amount: 0,
      discount: 99,
      durationDays: 3650,
      currency: 'USD',
    }

    const parsed = CreateCheckoutSchema.parse(crafted)

    expect(parsed).toEqual({ packageId: PACKAGE_ID })
    expect(Object.keys(parsed)).toEqual(['packageId'])
    for (const key of ['price', 'priceTry', 'amount', 'discount', 'durationDays', 'currency']) {
      expect(key in parsed).toBe(false)
    }
  })

  it('şemada fiyata benzer hiçbir alan tanımlı değildir', () => {
    const declared = Object.keys(CreateCheckoutSchema.shape)
    expect(declared).toEqual(['packageId'])
  })

  it('geçersiz kimliği reddeder', () => {
    expect(CreateCheckoutSchema.safeParse({ packageId: 'bedava' }).success).toBe(false)
    expect(CreateCheckoutSchema.safeParse({}).success).toBe(false)
    expect(CreateCheckoutSchema.safeParse({ packageId: 42 }).success).toBe(false)
  })
})
