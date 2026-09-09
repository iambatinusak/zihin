import { describe, expect, it } from 'vitest'
import {
  formatTimestamp,
  parseTimestamp,
  timelinePercent,
  validateCheckpointTimestamp,
} from './checkpoint'

const base = { durationSeconds: 600, existingTimestamps: [] as number[] }

describe('validateCheckpointTimestamp', () => {
  it('süre içindeki boş bir saniyeyi kabul eder', () => {
    expect(validateCheckpointTimestamp({ ...base, timestampSeconds: 120 })).toBeNull()
  })

  it('sıfırıncı saniyeyi kabul eder', () => {
    expect(validateCheckpointTimestamp({ ...base, timestampSeconds: 0 })).toBeNull()
  })

  it('süreye eşit ya da büyük zamanı reddeder', () => {
    expect(validateCheckpointTimestamp({ ...base, timestampSeconds: 600 })?.field).toBe(
      'timestampSeconds',
    )
    expect(validateCheckpointTimestamp({ ...base, timestampSeconds: 700 })).not.toBeNull()
  })

  it('negatif zamanı reddeder', () => {
    expect(validateCheckpointTimestamp({ ...base, timestampSeconds: -1 })?.message).toBe(
      'Zaman negatif olamaz.',
    )
  })

  it('tam sayı olmayan zamanı reddeder', () => {
    expect(validateCheckpointTimestamp({ ...base, timestampSeconds: 12.5 })?.message).toBe(
      'Zaman tam saniye olmalıdır.',
    )
  })

  it('aynı saniyedeki ikinci durağı reddeder (unique kısıtı)', () => {
    const issue = validateCheckpointTimestamp({
      ...base,
      timestampSeconds: 90,
      existingTimestamps: [30, 90, 150],
    })
    expect(issue?.message).toContain('1:30')
  })

  it('düzenlenen durağın kendi saniyesini çakışma saymaz', () => {
    expect(
      validateCheckpointTimestamp({
        ...base,
        timestampSeconds: 90,
        existingTimestamps: [30, 90],
        currentTimestamp: 90,
      }),
    ).toBeNull()
  })

  it('süre bilinmiyorsa (0) üst sınır denetlemez', () => {
    expect(
      validateCheckpointTimestamp({
        timestampSeconds: 9999,
        durationSeconds: 0,
        existingTimestamps: [],
      }),
    ).toBeNull()
  })
})

describe('formatTimestamp', () => {
  it('dakika:saniye biçimi verir', () => {
    expect(formatTimestamp(0)).toBe('0:00')
    expect(formatTimestamp(65)).toBe('1:05')
    expect(formatTimestamp(600)).toBe('10:00')
  })

  it('bir saati aşınca saat basamağını ekler', () => {
    expect(formatTimestamp(3723)).toBe('1:02:03')
  })

  it('negatif değeri sıfır sayar', () => {
    expect(formatTimestamp(-5)).toBe('0:00')
  })
})

describe('parseTimestamp', () => {
  it('düz saniyeyi okur', () => {
    expect(parseTimestamp('65')).toBe(65)
  })

  it('dakika:saniye okur', () => {
    expect(parseTimestamp('1:05')).toBe(65)
  })

  it('saat:dakika:saniye okur', () => {
    expect(parseTimestamp('1:02:03')).toBe(3723)
  })

  it('geçersiz girdide null döner', () => {
    expect(parseTimestamp('')).toBeNull()
    expect(parseTimestamp('abc')).toBeNull()
    expect(parseTimestamp('1:2:3:4')).toBeNull()
    expect(parseTimestamp('-5')).toBeNull()
  })
})

describe('timelinePercent', () => {
  it('oranı yüzdeye çevirir', () => {
    expect(timelinePercent(300, 600)).toBe(50)
  })

  it('süre yoksa sıfır döner', () => {
    expect(timelinePercent(300, 0)).toBe(0)
  })

  it('aralık dışını kırpar', () => {
    expect(timelinePercent(900, 600)).toBe(100)
  })
})
