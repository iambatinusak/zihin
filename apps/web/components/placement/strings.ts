import { section } from '@/lib/i18n/placement'

/** `i18n/tr/placement.json` → `placement.*` alt ağacının tipi. */
export type PlacementStrings = {
  title: string
  subtitle: string
  intro: string
  ruleQuestions: string
  ruleDuration: string
  ruleResume: string
  ruleHonest: string
  start: string
  starting: string
  resume: string
  skip: string
  skipHint: string
  startFailed: string
  doneTitle: string
  doneBody: string
  viewResult: string
  noExamTitle: string
  noExamBody: string
  goSettings: string
  emptyTitle: string
  emptyBody: string
  shortWarning: string
}

export function placementStrings(): PlacementStrings {
  return section<PlacementStrings>('placement')
}
