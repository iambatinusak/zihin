/**
 * `i18n/tr/test.json` + `i18n/tr/test-ui.json` birleşiminde `test` bölümünün
 * şekli. `section<TestStrings>('test')` böylece tipli okunur; bir anahtar
 * silinirse ya da adı değişirse derleme zamanında görünür.
 *
 * Yalnızca bu izin kullandığı anahtarlar yazılıdır — sözlükte bunlardan
 * fazlası da var (soru defteri listesi gibi, başka ekranlara ait).
 */
export type TestStrings = {
  title: string
  solve: string
  starting: string
  quickPracticeAction: string
  quickPracticeHint: string
  resumedNotice: string
  questionCounter: string
  questionLabel: string
  clearSelection: string
  previous: string
  next: string
  nextBlank: string
  noBlankLeft: string
  grid: string
  gridLegendAnswered: string
  gridLegendBlank: string
  gridLegendCurrent: string
  saving: string
  saved: string
  saveFailed: string
  autosaveHint: string
  noFeedbackHint: string
  timeRemaining: string
  timeUp: string
  expired: string
  finish: string
  finishConfirmTitle: string
  finishConfirmBlank: string
  finishConfirmComplete: string
  finishConfirmAction: string
  finishCancel: string
  alreadyFinished: string
  emptyTest: string
  emptyTestTitle: string
  notFoundTitle: string
  notFoundBody: string
  expiredTitle: string
  expiredBody: string
  restart: string
  backToLessons: string
  runner: {
    flag: string
    unflag: string
    flagged: string
    gridLegendFlagged: string
    gridStatus: string
    keyboardHint: string
    retrySave: string
    warningMinutes: string
    warningLastMinute: string
    questionImage: string
    optionSelected: string
    answeredOf: string
    finishing: string
  }
  result: {
    title: string
    correct: string
    wrong: string
    blank: string
    net: string
    score: string
    totalTime: string
    averageTime: string
    byTopic: string
    topicColumn: string
    bySubject: string
    subjectColumn: string
    totalColumn: string
    questionIndex: string
    reviewTitle: string
    reviewEmpty: string
    yourAnswer: string
    correctAnswer: string
    blankAnswer: string
    explanation: string
    noExplanation: string
    solutionVideo: string
    filterAll: string
    filterWrong: string
    filterBlank: string
    retry: string
    backToTopic: string
    addWrongToCards: string
    addWrongToCardsHint: string
    masteryHint: string
    masteryColumn: string
    masteryUnknown: string
    durationHour: string
    durationMinute: string
    durationSecond: string
    otherSubject: string
    correctBadge: string
    wrongBadge: string
    blankBadge: string
    bookmarkSaving: string
    bookmarkFailed: string
  }
  bookmark: {
    add: string
    remove: string
    added: string
    removed: string
  }
}
