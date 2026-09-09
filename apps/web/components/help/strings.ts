import { section } from '@/lib/i18n/help'

/**
 * `i18n/tr/help.json` içindeki `help` bölümünün şekli.
 * `helpStrings()` ile tipli okunur; silinen bir anahtar derleme zamanında görünür.
 */
export type HelpStrings = {
  title: string
  description: string
  formTitle: string
  subjectLabel: string
  subjectPlaceholder: string
  subjectRequired: string
  topicLabel: string
  topicPlaceholder: string
  topicAll: string
  bodyLabel: string
  bodyPlaceholder: string
  bodyHint: string
  imageLabel: string
  imageHint: string
  imageSelected: string
  imageResized: string
  imageRemove: string
  imageTooLarge: string
  imageWrongType: string
  imageUploadFailed: string
  imagePreview: string
  imageMissing: string
  emptyRequest: string
  submit: string
  submitting: string
  submitFailed: string

  quotaTitle: string
  quotaRemaining: string
  quotaUsed: string
  quotaExhausted: string
  quotaExhaustedServer: string
  quotaZero: string

  similarTitle: string
  similarBody: string
  similarOpen: string
  similarAccept: string
  similarReject: string
  similarAccepted: string
  similarPending: string
  similarSent: string
  similarNone: string
  similarScore: string

  historyTitle: string
  historyEmptyTitle: string
  historyEmptyBody: string
  historyOpen: string
  askedAt: string
  answeredAt: string

  statusOpen: string
  statusAnswered: string
  statusClosed: string
  statusPendingMatch: string

  detailTitle: string
  conversation: string
  messageFromStudent: string
  messageFromTeacher: string
  messagePlaceholder: string
  messageSend: string
  messageSending: string
  messageEmpty: string
  messageLimitHint: string
  messageLimitReached: string
  messageFailed: string
  closeRequest: string
  closeRequestDone: string
  closeRequestFailed: string
  backToList: string
  notFound: string

  teacherTitle: string
  teacherDescription: string
  teacherFilterLabel: string
  teacherFilterAll: string
  teacherFilterApply: string
  teacherQueueEmptyTitle: string
  teacherQueueEmptyBody: string
  teacherWaiting: string
  teacherAnswerTitle: string
  teacherAnswerLabel: string
  teacherAnswerHint: string
  teacherAnswerPlaceholder: string
  teacherAnswerImageLabel: string
  teacherAnswerVideoLabel: string
  teacherAnswerSubmit: string
  teacherAnswerSubmitting: string
  teacherAnswerEmpty: string
  teacherAnswerFailed: string
  teacherAnswerSent: string
  teacherAnswered: string
  teacherOpenDetail: string
  teacherBackToQueue: string
  teacherStudentLabel: string
  teacherNoBody: string
  teacherUrlInvalid: string

  studentsTitle: string
  studentsDescription: string
  studentsEmptyTitle: string
  studentsEmptyBody: string
  studentsColumnName: string
  studentsColumnGrade: string
  studentsColumnMastery: string
  studentsColumnMeasured: string
  studentsColumnStreak: string
  studentsStreakDays: string
  studentsNoExam: string
  studentsMeasured: string
  studentsWeakTopics: string

  notificationTitle: string
  notificationBody: string
}

/**
 * Sözlük bir kez okunur ve hem sunucu hem istemci bileşenleri aynı nesneyi
 * kullanır. `section()` saf bir okuma olduğu için istemci paketine yalnızca
 * JSON girer, çeviri altyapısı değil.
 */
export function helpStrings(): HelpStrings {
  return section<HelpStrings>('help')
}

/** Durum kodunun Türkçe etiketi. */
export function statusLabel(
  s: HelpStrings,
  status: 'open' | 'answered' | 'closed',
  hasPendingMatches = false,
): string {
  if (status === 'open') return hasPendingMatches ? s.statusPendingMatch : s.statusOpen
  if (status === 'answered') return s.statusAnswered
  return s.statusClosed
}
