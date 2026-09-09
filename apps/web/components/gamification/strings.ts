import { section } from '@/lib/i18n/gamification'

/** `i18n/tr/gamification.json` → `gamification.*` alt ağacının tipi. */
export type GamificationStrings = {
  title: string
  description: string
  levelTitle: string
  levelLabel: string
  levelMax: string
  xpTotal: string
  xpToNext: string
  xpIntoLevel: string
  streakTitle: string
  streakCurrent: string
  streakLongest: string
  streakDays: string
  streakNone: string
  badgesTitle: string
  badgesSubtitle: string
  badgeEarnedAt: string
  badgeLocked: string
  badgeLockedIconLabel: string
  badgeEarnedIconLabel: string
  ruleVideos: string
  ruleTests: string
  ruleStreak: string
  ruleMocks: string
  ruleCards: string
  ruleWeakToStrong: string
  ruleUnknown: string
  leaderboardTitle: string
  leaderboardSubtitle: string
  leaderboardRank: string
  leaderboardStudent: string
  leaderboardXp: string
  leaderboardYou: string
  leaderboardAnonymous: string
  leaderboardTableCaption: string
  leaderboardEmptyTitle: string
  leaderboardEmptyDescription: string
  leaderboardOptOutTitle: string
  leaderboardOptOutDescription: string
  leaderboardOptOutAction: string
  leaderboardPrivacy: string
  noExamTitle: string
  noExamDescription: string
  noExamAction: string
}

export function gamificationStrings(): GamificationStrings {
  return section<GamificationStrings>('gamification')
}
