import { describe, expect, it } from 'vitest'
import { fill } from '@/lib/i18n'
import {
  formatDuration,
  isContentLocked,
  isLearned,
  parseSubjectColor,
  summarizeProgress,
} from './progress'

describe('isLearned', () => {
  it('yalnızca orta ve güçlü konuları öğrenilmiş sayar', () => {
    expect(isLearned('unknown')).toBe(false)
    expect(isLearned('weak')).toBe(false)
    expect(isLearned('medium')).toBe(true)
    expect(isLearned('strong')).toBe(true)
  })
})

describe('summarizeProgress', () => {
  it('öğrenilmiş konu oranını yüzdeye çevirir', () => {
    expect(summarizeProgress(['strong', 'medium', 'weak'], 4)).toEqual({
      learned: 2,
      total: 4,
      percent: 50,
    })
  })

  it('konu yokken sıfır döner (bölme hatası olmaz)', () => {
    expect(summarizeProgress([], 0)).toEqual({ learned: 0, total: 0, percent: 0 })
  })

  it('yetkinlik satırı toplam konudan fazlaysa yüzdeyi 100 ile sınırlar', () => {
    expect(summarizeProgress(['strong', 'strong', 'strong'], 2)).toEqual({
      learned: 2,
      total: 2,
      percent: 100,
    })
  })

  it('ölçülmemiş konuları paydada bırakır', () => {
    expect(summarizeProgress(['unknown', 'unknown'], 10).percent).toBe(0)
  })
})

describe('formatDuration', () => {
  it('bir saatin altını mm:ss yazar', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(754)).toBe('12:34')
  })

  it('bir saat ve üstünü s:mm:ss yazar', () => {
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3903)).toBe('1:05:03')
  })

  it('geçersiz ve negatif değerleri sıfır sayar', () => {
    expect(formatDuration(-5)).toBe('0:00')
    expect(formatDuration(Number.NaN)).toBe('0:00')
  })
})

describe('isContentLocked', () => {
  it('abonelik varsa hiçbir şey kilitli değildir', () => {
    expect(
      isContentLocked({ hasSubscription: true, hasContent: true, hasFreePreview: false }),
    ).toBe(false)
  })

  it('içerik yoksa kilit değil, boş durum gösterilir', () => {
    expect(
      isContentLocked({ hasSubscription: false, hasContent: false, hasFreePreview: false }),
    ).toBe(false)
  })

  it('ücretsiz önizleme varsa kilitlenmez', () => {
    expect(
      isContentLocked({ hasSubscription: false, hasContent: true, hasFreePreview: true }),
    ).toBe(false)
  })

  it('aboneliksiz ve önizlemesiz içerik kilitlidir', () => {
    expect(
      isContentLocked({ hasSubscription: false, hasContent: true, hasFreePreview: false }),
    ).toBe(true)
  })
})

describe('fill', () => {
  it('yer tutucuları doldurur', () => {
    expect(fill('{learned} / {total} konu', { learned: 3, total: 12 })).toBe('3 / 12 konu')
  })

  it('karşılığı olmayan yer tutucuyu olduğu gibi bırakır', () => {
    expect(fill('{count} soru', {})).toBe('{count} soru')
  })
})

describe('parseSubjectColor', () => {
  it('geçerli HSL üçlüsünü kabul eder', () => {
    expect(parseSubjectColor('217 91% 60%')).toBe('217 91% 60%')
    expect(parseSubjectColor('  0 0% 100%  ')).toBe('0 0% 100%')
  })

  it('boş ve bozuk değerleri reddeder', () => {
    expect(parseSubjectColor(null)).toBeNull()
    expect(parseSubjectColor('#ff0000')).toBeNull()
    expect(parseSubjectColor('red; content: url(x)')).toBeNull()
    expect(parseSubjectColor('217 91 60')).toBeNull()
  })
})
