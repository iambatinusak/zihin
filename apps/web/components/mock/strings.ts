/**
 * `i18n/tr/mock.json` içindeki `mock` bölümünün şekli.
 * `section<MockStrings>('mock')` böylece tipli okunur; bir anahtar silinirse ya
 * da adı değişirse derleme zamanında görünür.
 *
 * Denemeye ÖZGÜ metinler burada. Çözme ekranının ortak metinleri (kaydediliyor,
 * bitir, ızgara, klavye ipucu...) `test` sözlüğünden okunur — aynı cümleyi iki
 * sözlükte tutmak, ikisinin ayrışmasının garantisidir.
 */
export type MockStrings = {
  title: string
  subtitle: string
  otherSubject: string
  emptyTitle: string
  emptyBody: string
  noExamTitle: string
  noExamBody: string
  goSettings: string
  backToList: string

  questionCount: string
  durationMinutes: string
  noDuration: string
  sectionsLabel: string
  sectionCount: string
  partialNotice: string

  statusNotStarted: string
  statusInProgress: string
  statusFinished: string
  netLabel: string
  finishedAt: string

  start: string
  starting: string
  resume: string
  retry: string
  viewResult: string
  startFailed: string

  windowBefore: string
  windowOpen: string
  windowBeforeHint: string
  windowOpenHint: string
  windowClosedHint: string
  windowClosedTitle: string
  countdownStarted: string
  countdownDay: string
  countdownHour: string
  countdownMinute: string
  countdownSecond: string

  runner: {
    sectionsLabel: string
    sectionTab: string
    sectionProgress: string
    sectionEmpty: string
    globalTimer: string
    sectionGrid: string
    overallProgress: string
  }

  result: {
    title: string
    overall: string
    overallNet: string
    bySection: string
    sectionColumn: string
    totalColumn: string
    correct: string
    wrong: string
    blank: string
    net: string
    emptySection: string
    percentileTitle: string
    percentileValue: string
    percentileHint: string
    percentileEstimate: string
    percentileInsufficient: string
    percentileInsufficientHint: string
    rankingLocked: string
    rankingLockedHint: string
    reviewTitle: string
    emptyTitle: string
    emptyBody: string
  }

  notFoundTitle: string
  notFoundBody: string
  expiredTitle: string
  expiredBody: string
}
