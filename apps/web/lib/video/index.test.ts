import { beforeEach, describe, expect, it, vi } from 'vitest'

// `server-only` yalnızca RSC bağlamında çözülür; sağlayıcı modülleri onu
// içe aktardığı için testte etkisiz hâle getirilir.
vi.mock('server-only', () => ({}))

const supabaseFactory = vi.fn(() => ({
  getSignedUrl: vi.fn(),
  getThumbnailUrl: () => null,
}))
const bunnyFactory = vi.fn(() => ({
  getSignedUrl: vi.fn(),
  getThumbnailUrl: () => null,
}))

vi.mock('./supabase-provider', () => ({ createSupabaseVideoProvider: supabaseFactory }))
vi.mock('./bunny-provider', () => ({ createBunnyVideoProvider: bunnyFactory }))

const serverEnv = vi.fn(() => ({ VIDEO_PROVIDER: 'supabase' as 'supabase' | 'bunny' }))
vi.mock('@/lib/env', () => ({ serverEnv }))

const { getVideoProvider } = await import('./index')

describe('getVideoProvider', () => {
  beforeEach(() => {
    supabaseFactory.mockClear()
    bunnyFactory.mockClear()
    serverEnv.mockReturnValue({ VIDEO_PROVIDER: 'supabase' })
  })

  it('açıkça verilen adı kullanır', () => {
    getVideoProvider('bunny')
    expect(bunnyFactory).toHaveBeenCalledTimes(1)
    expect(supabaseFactory).not.toHaveBeenCalled()
  })

  it('ad verilmezse ortam değişkenine düşer', () => {
    getVideoProvider()
    expect(supabaseFactory).toHaveBeenCalledTimes(1)

    serverEnv.mockReturnValue({ VIDEO_PROVIDER: 'bunny' })
    getVideoProvider()
    expect(bunnyFactory).toHaveBeenCalledTimes(1)
  })

  it('bunny seçiliyken bile import anında hata vermez; fabrika çağrılır', () => {
    expect(() => getVideoProvider('bunny')).not.toThrow()
  })
})
