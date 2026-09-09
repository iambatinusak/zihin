/**
 * `i18n/tr/panel.json` içindeki `panel` bölümünün şekli.
 * `section<PanelStrings>('panel')` böylece tipli okunur; bir anahtar silinirse
 * derleme zamanında görünür.
 */
export type PanelStrings = {
  title: string
  description: string

  overallAverage: string
  measuredTopics: string
  topicCount: string
  outOfHundred: string

  heatMapTitle: string
  heatMapDescription: string
  heatMapNavLabel: string
  heatMapHint: string
  legendLabel: string
  unitTopicsLabel: string
  attemptsLabel: string
  statusLabel: string
  scoreLabel: string
  notMeasuredYet: string
  cellDescription: string

  priorityTitle: string
  priorityDescription: string
  priorityEmpty: string
  actionWatch: string
  actionOpenTopic: string
  actionPractice: string
  actionCards: string
  priorityRowLabel: string

  trendTitle: string
  trendDescription: string
  trendEmpty: string
  trendTableCaption: string
  trendSummary: string
  trendSummarySingle: string
  weekLabel: string
  averageLabel: string
  sampleLabel: string

  radarTitle: string
  radarDescription: string
  radarEmpty: string
  radarTableCaption: string
  radarSummary: string
  subjectLabel: string

  emptyTitle: string
  emptyDescription: string
  emptyPrimary: string
  emptySecondary: string

  noExamTitle: string
  noExamDescription: string
  noExamAction: string
}
