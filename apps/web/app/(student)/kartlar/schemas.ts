import { z } from 'zod'
import { REVIEW_GRADES } from '@/lib/cards/queue'

/**
 * Kart action'larının girdi şemaları.
 *
 * Puan alanı `z.number()` DEĞİL, dört düğmenin değerlerinden oluşan kapalı bir
 * kümedir: Server Action herkese açık bir uçtur ve arayüzde hiç bulunmayan bir
 * puan (0, 2, 5.5) SM-2'yi sömürmek için gönderilebilir.
 */

const GRADE_VALUES = [
  REVIEW_GRADES.again,
  REVIEW_GRADES.hard,
  REVIEW_GRADES.good,
  REVIEW_GRADES.easy,
] as const

export const ReviewCardSchema = z.object({
  flashcardId: z.string().uuid('Geçersiz kart kimliği.'),
  grade: z.union([
    z.literal(GRADE_VALUES[0]),
    z.literal(GRADE_VALUES[1]),
    z.literal(GRADE_VALUES[2]),
    z.literal(GRADE_VALUES[3]),
  ]),
})

export const AddWrongAnswersToCardsSchema = z.object({
  sessionId: z.string().uuid('Geçersiz oturum kimliği.'),
})
