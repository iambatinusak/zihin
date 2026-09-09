import type { PlanTemplate, StudyBlockType } from '@zihin/core'

/**
 * `i18n/tr/program.json` içindeki `program` bölümünün şekli.
 * `section<ProgramStrings>('program')` böylece tipli okunur; bir anahtar
 * silinirse derleme zamanında görünür.
 */
export type ProgramStrings = {
  title: string
  description: string
  todayTitle: string
  todayDescription: string
  todayAllDone: string
  todayEmpty: string
  todayGoToPlan: string
  todayRemaining: string
  weekOf: string
  previousWeek: string
  nextWeek: string
  currentWeek: string
  thisWeekBadge: string
  regenerate: string
  regenerating: string
  regenerated: string
  regenerateFailed: string
  regenerateHint: string
  templateLabel: string
  templates: Record<PlanTemplate, string>
  templateHints: Record<PlanTemplate, string>
  warningsTitle: string
  warningsDescription: string
  emptyTitle: string
  emptyDescription: string
  emptyDayTitle: string
  noExamTitle: string
  noExamDescription: string
  noExamAction: string
  pastWeekNotice: string
  blockTypes: Record<StudyBlockType, string>
  blockTypeLegend: string
  minutesShort: string
  watchAction: string
  solveAction: string
  reviewAction: string
  mockAction: string
  topicAction: string
  contentPendingTitle: string
  contentPending: string
  complete: string
  completed: string
  uncomplete: string
  completeFailed: string
  completedToast: string
  xpAwarded: string
  uncompletedToast: string
  moveMenu: string
  moveMenuLabel: string
  moved: string
  moveFailed: string
  movedFrom: string
  dragHandle: string
  dragInstructions: string
  dropHere: string
  announceGrabbed: string
  announceCancelled: string
  announceOver: string
  summaryBlocks: string
  summaryMinutes: string
  summaryCompleted: string
  weekdayNames: string[]
  weekdayShort: string[]
  monthNames: string[]
}
