import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  isAllowedImageSize,
  isAllowedImageType,
  MAX_IMAGE_BYTES,
  resizeDimensions,
} from './image'

describe('resizeDimensions', () => {
  it('yatay görselde genişliği 1600e indirir, oranı korur', () => {
    expect(resizeDimensions({ width: 4000, height: 3000 })).toEqual({ width: 1600, height: 1200 })
  })

  it('dikey görselde yüksekliği 1600e indirir', () => {
    expect(resizeDimensions({ width: 3000, height: 4000 })).toEqual({ width: 1200, height: 1600 })
  })

  it('kare görselde iki kenar da 1600 olur', () => {
    expect(resizeDimensions({ width: 2400, height: 2400 })).toEqual({ width: 1600, height: 1600 })
  })

  it('zaten küçük görseli BÜYÜTMEZ', () => {
    expect(resizeDimensions({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 })
  })

  it('tam sınırdaki görsele dokunmaz', () => {
    expect(resizeDimensions({ width: 1600, height: 900 })).toEqual({ width: 1600, height: 900 })
  })

  it('kısa kenarı yuvarlar ve en az 1 px bırakır', () => {
    expect(resizeDimensions({ width: 5000, height: 3 })).toEqual({ width: 1600, height: 1 })
    expect(resizeDimensions({ width: 3333, height: 1111 })).toEqual({ width: 1600, height: 533 })
  })

  it('özel bir en uzun kenar verilebilir', () => {
    expect(resizeDimensions({ width: 1000, height: 500 }, 200)).toEqual({ width: 200, height: 100 })
  })

  it('geçersiz ölçüde sıfır döner', () => {
    expect(resizeDimensions({ width: 0, height: 100 })).toEqual({ width: 0, height: 0 })
    expect(resizeDimensions({ width: Number.NaN, height: 100 })).toEqual({ width: 0, height: 0 })
  })

  it('geçersiz maxEdge girdiyi olduğu gibi bırakır', () => {
    expect(resizeDimensions({ width: 900, height: 400 }, 0)).toEqual({ width: 900, height: 400 })
  })
})

describe('görsel doğrulama', () => {
  it('izinli türleri tanır, büyük/küçük harfe takılmaz', () => {
    expect(isAllowedImageType('image/jpeg')).toBe(true)
    expect(isAllowedImageType('IMAGE/PNG')).toBe(true)
    expect(isAllowedImageType('application/pdf')).toBe(false)
    expect(isAllowedImageType(null)).toBe(false)
  })

  it('5 MB sınırı', () => {
    expect(isAllowedImageSize(MAX_IMAGE_BYTES)).toBe(true)
    expect(isAllowedImageSize(MAX_IMAGE_BYTES + 1)).toBe(false)
    expect(isAllowedImageSize(0)).toBe(false)
  })
})

describe('formatBytes', () => {
  it('KB ve MB biçimler', () => {
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 MB')
    expect(formatBytes(-1)).toBe('0 KB')
  })
})
