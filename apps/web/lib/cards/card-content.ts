/**
 * Yanlış cevaptan üretilen kartın ön/arka yüz metni.
 *
 * Saf ve çerçeve bağımsızdır (Supabase tanımaz), böylece birim testi
 * yazılabilir. İçerik Markdown'dır; sunucuda `components/common/markdown.tsx`
 * ile basılır.
 */

import type { QuestionOption } from '@/lib/questions/options'

/** Kart üretimi için sorunun gereken en az bilgisi. */
export type CardSourceQuestion = {
  id: string
  topicId: string
  stem: string
  options: QuestionOption[]
  correctOption: string
  explanation: string | null
}

/** Ön yüz: sorunun kökü. Şıklar bilerek yazılmaz — kart bir test değil. */
export function buildCardFront(question: CardSourceQuestion): string {
  return question.stem.trim()
}

/**
 * Arka yüz: doğru şık + (varsa) açıklama.
 *
 * Şık metni bulunamazsa yalnızca anahtarı yazılır; eksik bir arka yüz,
 * hiç üretilmemiş bir karttan iyidir.
 */
export function buildCardBack(question: CardSourceQuestion): string {
  const correct = question.options.find((option) => option.key === question.correctOption)
  const answerText = correct?.text.trim()

  const heading = answerText
    ? `**Doğru cevap: ${question.correctOption})** ${answerText}`
    : `**Doğru cevap: ${question.correctOption}**`

  const explanation = question.explanation?.trim()
  return explanation ? `${heading}\n\n${explanation}` : heading
}
