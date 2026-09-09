import { z } from 'zod'

import { MAX_WATCH_DELTA_SECONDS } from '@/lib/video/progress'

/** Video akışındaki tüm Server Action girdilerinin şemaları. */

export const NOTE_MAX_LENGTH = 2000

const uuid = z.string().uuid('Geçersiz kayıt kimliği.')
const seconds = z.number().finite().min(0, 'Zaman değeri negatif olamaz.')

export const VideoIdSchema = z.object({ videoId: uuid })

export const SaveProgressSchema = z.object({
  videoId: uuid,
  positionSeconds: seconds,
  // Üst sınır burada da yazılır: kurcalanmış bir istemci sunucuyu hiç
  // meşgul etmeden reddedilsin (asıl kırpma lib/video/progress.ts içinde).
  watchedDeltaSeconds: z
    .number()
    .finite()
    .min(0, 'İzleme süresi negatif olamaz.')
    .max(MAX_WATCH_DELTA_SECONDS, 'Tek seferde bildirilen izleme süresi çok uzun.'),
})

export const AddNoteSchema = z.object({
  videoId: uuid,
  timestampSeconds: seconds,
  body: z
    .string()
    .trim()
    .min(1, 'Not boş olamaz.')
    .max(NOTE_MAX_LENGTH, `Not en fazla ${NOTE_MAX_LENGTH} karakter olabilir.`),
})

export const UpdateNoteSchema = z.object({
  noteId: uuid,
  body: z
    .string()
    .trim()
    .min(1, 'Not boş olamaz.')
    .max(NOTE_MAX_LENGTH, `Not en fazla ${NOTE_MAX_LENGTH} karakter olabilir.`),
})

export const DeleteNoteSchema = z.object({ noteId: uuid })

export const AnswerCheckpointSchema = z.object({
  checkpointId: uuid,
  selectedOption: z.string().trim().min(1, 'Bir şık seçmelisiniz.').max(8, 'Geçersiz şık.'),
  timeSpentMs: z
    .number()
    .int()
    .min(0)
    .max(10 * 60 * 1000)
    .default(0),
})
