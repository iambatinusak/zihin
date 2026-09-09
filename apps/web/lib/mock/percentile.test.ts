import { describe, expect, it } from 'vitest'
import {
  MIN_PERCENTILE_SAMPLE,
  buildNetPopulation,
  buildPercentileView,
  formatTopPercent,
} from './percentile'

/** `count` kadar net üretir; hepsi kullanıcının netinden düşük. */
function lowerNets(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index * 0.5)
}

describe('buildPercentileView — örnek eşiği (spec §15)', () => {
  it('19 katılımcıda dilim hesaplanmaz', () => {
    const view = buildPercentileView(80, lowerNets(19))
    expect(view).toEqual({
      status: 'insufficient',
      sampleSize: 19,
      required: MIN_PERCENTILE_SAMPLE,
    })
  })

  it('tam 20 katılımcıda dilim açılır', () => {
    const view = buildPercentileView(80, lowerNets(20))
    expect(view.status).toBe('ready')
    if (view.status !== 'ready') return
    expect(view.sampleSize).toBe(20)
    // Kullanıcı listedeki 19 kişiden yüksek, 1 kişiyle (0.5*... hiçbiri 80
    // değil) eşit değil -> dilim 100'e çok yakın.
    expect(view.percentile).toBeGreaterThan(90)
  })

  it('eşik sabiti 20', () => {
    expect(MIN_PERCENTILE_SAMPLE).toBe(20)
  })

  it('geçersiz netler ne payı ne paydayı bozar', () => {
    const nets = [...lowerNets(19), Number.NaN, Number.POSITIVE_INFINITY]
    expect(buildPercentileView(80, nets)).toMatchObject({ status: 'insufficient', sampleSize: 19 })
  })

  it('dilim 100 iken "ilk %0" yerine en küçük anlamlı değer gösterilir', () => {
    const nets = Array.from({ length: 25 }, () => 10)
    nets.push(90)
    const view = buildPercentileView(90, nets)
    expect(view.status).toBe('ready')
    if (view.status !== 'ready') return
    expect(view.topPercent).toBeGreaterThan(0)
  })

  it('medyan öğrenci ortalarda çıkar', () => {
    const nets = [
      ...Array.from({ length: 10 }, () => 10),
      50,
      ...Array.from({ length: 10 }, () => 90),
    ]
    const view = buildPercentileView(50, nets)
    expect(view.status).toBe('ready')
    if (view.status !== 'ready') return
    expect(view.percentile).toBeCloseTo(50, 0)
  })
})

describe('buildNetPopulation', () => {
  it('kullanıcının kendi kaydını sunucunun hesabıyla değiştirir', () => {
    const nets = buildNetPopulation(
      [
        { sessionId: 'a', userId: 'ayse', net: 10 },
        { sessionId: 'ben', userId: 'ben', net: 1 },
        { sessionId: 'b', userId: 'burak', net: 20 },
      ],
      { sessionId: 'ben', userId: 'ben', net: 33 },
    )
    expect(nets.sort((x, y) => x - y)).toEqual([10, 20, 33])
  })

  it('kullanıcının BAŞKA bitmiş oturumları da elenir', () => {
    // Deneme yeniden çözülebiliyor: eski oturumlar ayrı katılımcı sayılamaz.
    const nets = buildNetPopulation(
      [
        { sessionId: 'eski', userId: 'ben', net: 5 },
        { sessionId: 'daha-eski', userId: 'ben', net: 2 },
        { sessionId: 'a', userId: 'ayse', net: 10 },
      ],
      { sessionId: 'yeni', userId: 'ben', net: 33 },
    )
    expect(nets.sort((x, y) => x - y)).toEqual([10, 33])
  })

  it('başka katılımcı birden çok kez çözdüyse EN İYİ neti alınır', () => {
    const nets = buildNetPopulation(
      [
        { sessionId: 'a1', userId: 'ayse', net: 10 },
        { sessionId: 'a2', userId: 'ayse', net: 40 },
        { sessionId: 'a3', userId: 'ayse', net: 25 },
      ],
      { sessionId: 'ben', userId: 'ben', net: 33 },
    )
    expect(nets.sort((x, y) => x - y)).toEqual([33, 40])
  })

  it('tek kişi çok çözerek 20 kişilik eşiği dolduramaz', () => {
    const participants = Array.from({ length: 30 }, (_, index) => ({
      sessionId: `s${index}`,
      userId: 'tek-kisi',
      net: index,
    }))
    const nets = buildNetPopulation(participants, { sessionId: 'ben', userId: 'ben', net: 50 })
    expect(nets).toHaveLength(2)
    expect(buildPercentileView(50, nets).status).toBe('insufficient')
  })

  it('kaydı olmayan kullanıcı yine listeye girer', () => {
    expect(
      buildNetPopulation([{ sessionId: 'a', userId: 'ayse', net: 10 }], {
        sessionId: 'ben',
        userId: 'ben',
        net: 5,
      }),
    ).toEqual([10, 5])
  })

  it('geçersiz netler elenir', () => {
    const nets = buildNetPopulation(
      [
        { sessionId: 'a', userId: 'ayse', net: Number.NaN },
        { sessionId: 'b', userId: 'burak', net: 7 },
      ],
      { sessionId: 'ben', userId: 'ben', net: Number.NaN },
    )
    expect(nets).toEqual([7])
  })
})

describe('formatTopPercent', () => {
  it('tam sayıda ondalık yazmaz', () => {
    expect(formatTopPercent(12)).toBe('12')
  })

  it('ondalıkta Türkçe virgül kullanır', () => {
    expect(formatTopPercent(0.5)).toBe('0,5')
  })
})
