/**
 * `i18n/tr/catalog.json` içindeki `catalog` bölümünün şekli.
 * `section<CatalogStrings>('catalog')` çağrıları böylece tipli okunur ve
 * eksik anahtar derleme zamanında fark edilir.
 */
export type CatalogStrings = {
  title: string
  description: string
  breadcrumbRoot: string
  noExamTitle: string
  noExamDescription: string
  noExamAction: string
  noSubjectsTitle: string
  noSubjectsDescription: string
  noUnitsTitle: string
  noUnitsDescription: string
  noTopicsTitle: string
  unitCount: string
  topicCount: string
  subjectMeta: string
  topicHeaderMeta: string
  progress: string
  progressHint: string
  learnedOfTotal: string
  unitTopicCount: string
  unitMinutes: string
  locked: string
  lockedHint: string
  freePreview: string
  estimatedMinutes: string
  difficulty: string
  examWeight: string
  tabs: { videos: string; memoryNote: string; tests: string; flashcards: string }
  videoTypes: { lecture: string; solution: string; summary: string }
  testTypes: {
    topic_test: string
    unit_test: string
    quick_practice: string
    mock_exam: string
  }
  watchVideo: string
  solveTest: string
  openCards: string
  flashcardCount: string
  questionCount: string
  emptyContentTitle: string
  emptyVideos: string
  emptyMemoryNote: string
  emptyTests: string
  emptyFlashcards: string
}
