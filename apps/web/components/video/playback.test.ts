import { describe, expect, it } from 'vitest'
import {
  MAX_TIMEUPDATE_DELTA_SECONDS,
  clampTime,
  clampVolume,
  dueCheckpoint,
  hasReachedCompletion,
  isHlsSource,
  percentSeekTarget,
  seekTarget,
  timeFromRatio,
  toPercent,
  watchedDelta,
} from './playback'

const CHECKPOINTS = [
  { id: 'c1', timestampSeconds: 30 },
  { id: 'c2', timestampSeconds: 90 },
  { id: 'c3', timestampSeconds: 91 },
]

describe('clampTime', () => {
  it('konumu süreye sıkıştırır', () => {
    expect(clampTime(120, 100)).toBe(100)
    expect(clampTime(40, 100)).toBe(40)
  })

  it('negatif ve geçersiz değerleri sıfırlar', () => {
    expect(clampTime(-4, 100)).toBe(0)
    expect(clampTime(Number.NaN, 100)).toBe(0)
  })

  it('süre bilinmiyorsa üst sınır uygulamaz', () => {
    expect(clampTime(120, 0)).toBe(120)
  })
})

describe('clampVolume', () => {
  it('0-1 aralığına sıkıştırır', () => {
    expect(clampVolume(1.4)).toBe(1)
    expect(clampVolume(-0.2)).toBe(0)
    expect(clampVolume(0.55)).toBe(0.55)
  })

  it('kayan nokta artığını temizler', () => {
    expect(clampVolume(0.1 + 0.2)).toBe(0.3)
  })
})

describe('watchedDelta', () => {
  it('normal oynatmada farkı sayar', () => {
    expect(watchedDelta(10, 10.25)).toBeCloseTo(0.25)
  })

  it('geri sarmayı saymaz', () => {
    expect(watchedDelta(50, 10)).toBe(0)
    expect(watchedDelta(50, 50)).toBe(0)
  })

  it('ileri sarmayı saymaz', () => {
    expect(watchedDelta(10, 400)).toBe(0)
    expect(watchedDelta(10, 10 + MAX_TIMEUPDATE_DELTA_SECONDS + 0.01)).toBe(0)
  })

  it('eşiğin tam üstündeki farkı kabul eder', () => {
    expect(watchedDelta(10, 12)).toBe(2)
  })

  it('geçersiz girdide sıfır döner', () => {
    expect(watchedDelta(Number.NaN, 5)).toBe(0)
    expect(watchedDelta(5, Number.NaN)).toBe(0)
  })
})

describe('dueCheckpoint', () => {
  const none = new Set<string>()

  it('aralıkta kalan checkpoint’i döner', () => {
    expect(dueCheckpoint(CHECKPOINTS, 29.5, 30.2, none)?.id).toBe('c1')
  })

  it('aralıkta birden çok varsa en erken olanı döner', () => {
    expect(dueCheckpoint(CHECKPOINTS, 89.5, 91, none)?.id).toBe('c2')
  })

  it('tetiklenmiş checkpoint’i atlar', () => {
    expect(dueCheckpoint(CHECKPOINTS, 89.5, 91, new Set(['c2']))?.id).toBe('c3')
  })

  it('geri sarmada tetiklenmez', () => {
    expect(dueCheckpoint(CHECKPOINTS, 100, 20, none)).toBeNull()
    expect(dueCheckpoint(CHECKPOINTS, 30, 30, none)).toBeNull()
  })

  it('ileri atlamada tetiklenmez', () => {
    expect(dueCheckpoint(CHECKPOINTS, 0, 120, none)).toBeNull()
  })

  it('tam sınırda: geçilmemiş konum tetiklemez, geçilen tetikler', () => {
    expect(dueCheckpoint(CHECKPOINTS, 28, 29.9, none)).toBeNull()
    expect(dueCheckpoint(CHECKPOINTS, 29, 30, none)?.id).toBe('c1')
  })

  it('boş listede null döner', () => {
    expect(dueCheckpoint([], 0, 1, none)).toBeNull()
  })
})

describe('percentSeekTarget', () => {
  it('rakamı yüzdeye çevirir', () => {
    expect(percentSeekTarget(0, 200)).toBe(0)
    expect(percentSeekTarget(5, 200)).toBe(100)
    expect(percentSeekTarget(9, 200)).toBe(180)
  })

  it('geçersiz rakam ve süreyi sıfırlar', () => {
    expect(percentSeekTarget(10, 200)).toBe(0)
    expect(percentSeekTarget(-1, 200)).toBe(0)
    expect(percentSeekTarget(3, 0)).toBe(0)
  })
})

describe('seekTarget', () => {
  it('ileri ve geri adımı sınırlar içinde tutar', () => {
    expect(seekTarget(100, 10, 200)).toBe(110)
    expect(seekTarget(5, -10, 200)).toBe(0)
    expect(seekTarget(195, 10, 200)).toBe(200)
  })

  it('geçersiz konumu sıfır sayar', () => {
    expect(seekTarget(Number.NaN, 10, 200)).toBe(10)
  })
})

describe('toPercent ve timeFromRatio', () => {
  it('konumu yüzdeye çevirir', () => {
    expect(toPercent(50, 200)).toBe(25)
    expect(toPercent(400, 200)).toBe(100)
    expect(toPercent(50, 0)).toBe(0)
  })

  it('oranı konuma çevirir ve 0-1 dışını kırpar', () => {
    expect(timeFromRatio(0.25, 200)).toBe(50)
    expect(timeFromRatio(-1, 200)).toBe(0)
    expect(timeFromRatio(2, 200)).toBe(200)
    expect(timeFromRatio(0.5, 0)).toBe(0)
  })
})

describe('hasReachedCompletion', () => {
  it('yüzde 90 ve üstünde tamamlanmış sayar', () => {
    expect(hasReachedCompletion(90, 100)).toBe(true)
    expect(hasReachedCompletion(95, 100)).toBe(true)
  })

  it('eşiğin altında tamamlanmış saymaz', () => {
    expect(hasReachedCompletion(89.9, 100)).toBe(false)
  })

  it('süre bilinmiyorsa tamamlanmış saymaz', () => {
    expect(hasReachedCompletion(500, 0)).toBe(false)
    expect(hasReachedCompletion(500, Number.NaN)).toBe(false)
  })
})

describe('isHlsSource', () => {
  it('m3u8 uzantısını tanır', () => {
    expect(isHlsSource('https://cdn.example.com/a/playlist.m3u8')).toBe(true)
    expect(isHlsSource('https://cdn.example.com/a/playlist.m3u8?token=abc&expires=1')).toBe(true)
    expect(isHlsSource('https://cdn.example.com/a/PLAYLIST.M3U8')).toBe(true)
  })

  it('mp4 kaynağını HLS saymaz', () => {
    expect(isHlsSource('https://cdn.example.com/a/video.mp4?token=x')).toBe(false)
    expect(isHlsSource('')).toBe(false)
  })
})
