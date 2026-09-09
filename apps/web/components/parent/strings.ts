import { section } from '@/lib/i18n/parent-panel'

/** `i18n/tr/parent-panel.json` → `parentPanel.*` alt ağacının tipi. */
export type ParentPanelStrings = {
  title: string
  description: string
  reportsTitle: string
  reportsDescription: string
  studentsTitle: string
  studentsDescription: string
  readOnlyNotice: string
  selector: { label: string; hint: string; submit: string; nameless: string }
  noStudentTitle: string
  noStudentDescription: string
  noStudentAction: string
  noExamTitle: string
  noExamDescription: string
  week: {
    previous: string
    next: string
    current: string
    label: string
    thisWeekBadge: string
  }
  summary: {
    title: string
    studyTime: string
    videos: string
    questions: string
    accuracy: string
    blocks: string
    blocksValue: string
    minuteUnit: string
    videoUnit: string
    questionUnit: string
    hourMinute: string
    noData: string
    accuracyEmpty: string
    blocksEmpty: string
  }
  delta: {
    up: string
    down: string
    flat: string
    new: string
    newShort: string
    none: string
    caption: string
  }
  weakTopics: {
    title: string
    description: string
    emptyTitle: string
    emptyDescription: string
    attempts: string
    scoreLabel: string
  }
  mocks: {
    title: string
    description: string
    emptyTitle: string
    emptyDescription: string
    net: string
    totalNet: string
    correct: string
    wrong: string
    blank: string
    percentile: string
    percentileEmpty: string
    subjectsTitle: string
    subjectColumn: string
    netColumn: string
  }
  notification: {
    title: string
    body: string
    accuracyUnknown: string
    studentFallback: string
  }
}

/** Sözlük tek yerden okunur; her bileşen kendi `t()` çağrısını yapmaz. */
export function parentStrings(): ParentPanelStrings {
  return section<ParentPanelStrings>('parentPanel')
}

/** Öğrencinin ekranda görünen adı; ad yoksa nötr bir ifade kullanılır. */
export function studentLabel(
  student: { displayName: string | null; fullName: string | null },
  nameless: string,
): string {
  return student.displayName?.trim() || student.fullName?.trim() || nameless
}
