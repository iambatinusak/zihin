/**
 * `i18n/tr/cards.json` içindeki `cards` bölümünün şekli.
 * `section<CardStrings>('cards')` böylece tipli okunur; bir anahtar silinirse
 * derleme zamanında görünür.
 */
export type CardStrings = {
  title: string
  description: string
  reviewTitle: string
  progress: string
  flip: string
  flipHint: string
  front: string
  back: string
  cardImage: string
  gradeQuestion: string
  gradeAgain: string
  gradeHard: string
  gradeGood: string
  gradeEasy: string
  gradeAgainHint: string
  gradeHardHint: string
  gradeGoodHint: string
  gradeEasyHint: string
  gradeAnnouncement: string
  keyboardHint: string
  saving: string
  saveFailed: string
  doneTitle: string
  doneBody: string
  doneXp: string
  doneRemaining: string
  backToLessons: string
  emptyQueueTitle: string
  emptyQueueBody: string
  noExamTitle: string
  noExamBody: string
  filterTitle: string
  filterLabel: string
  filterAll: string
  filterApply: string
  filterEmpty: string
  topicCardCount: string
  editorCards: string
  editorCardsHint: string
  myCards: string
  myCardsHint: string
  editorCardsEmpty: string
  myCardsEmpty: string
  showAnswer: string
  autoBadge: string
  dueBadge: string
  addWrongSuccess: string
  addWrongNone: string
  addWrongFailed: string
  addWrongPending: string
}
