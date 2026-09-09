import { describe, expect, it } from 'vitest'
import { buildCardBack, buildCardFront, type CardSourceQuestion } from './card-content'

function question(overrides: Partial<CardSourceQuestion> = {}): CardSourceQuestion {
  return {
    id: 'q1',
    topicId: 't1',
    stem: '  $x^2 = 9$ ise $x$ kaçtır?  ',
    options: [
      { key: 'A', text: '2' },
      { key: 'B', text: '3' },
    ],
    correctOption: 'B',
    explanation: '  Karekök alınır.  ',
    ...overrides,
  }
}

describe('buildCardFront', () => {
  it('soru kökünü kırpar', () => {
    expect(buildCardFront(question())).toBe('$x^2 = 9$ ise $x$ kaçtır?')
  })
})

describe('buildCardBack', () => {
  it('doğru şıkkı ve açıklamayı birleştirir', () => {
    expect(buildCardBack(question())).toBe('**Doğru cevap: B)** 3\n\nKarekök alınır.')
  })

  it('açıklama yoksa yalnızca doğru şıkkı yazar', () => {
    expect(buildCardBack(question({ explanation: null }))).toBe('**Doğru cevap: B)** 3')
    expect(buildCardBack(question({ explanation: '   ' }))).toBe('**Doğru cevap: B)** 3')
  })

  it('şık metni bulunamazsa anahtarla yetinir', () => {
    expect(buildCardBack(question({ options: [], explanation: null }))).toBe('**Doğru cevap: B**')
  })
})
