import { section } from '@/lib/i18n/placement'

/** `i18n/tr/placement.json` → `dashboard.*` alt ağacının tipi. */
export type DashboardStrings = {
  title: string
  greeting: string
  subtitle: string
  todayTitle: string
  todayPending: string
  todayEmpty: string
  goProgram: string
  streakTitle: string
  streakDays: string
  streakEmpty: string
  streakHint: string
  levelTitle: string
  levelLabel: string
  levelMax: string
  xpToNext: string
  xpTotal: string
  cardsTitle: string
  cardsDue: string
  cardsEmpty: string
  goCards: string
  priorityTitle: string
  priorityEmpty: string
  priorityEmptyHint: string
  goLessons: string
  mockTitle: string
  mockNet: string
  mockCorrect: string
  mockWrong: string
  mockBlank: string
  mockPercentile: string
  mockEmpty: string
  mockEmptyHint: string
  weeklyTitle: string
  weeklySubtitle: string
  weeklyEmpty: string
  weeklyEmptyHint: string
  weeklyTableCaption: string
  weeklyDay: string
  weeklyMinutes: string
  weeklyTotal: string
  minutesShort: string
  welcomeTitle: string
  welcomeBody: string
  welcomeSecondary: string
}

export function dashboardStrings(): DashboardStrings {
  return section<DashboardStrings>('dashboard')
}
