import { section } from '@/lib/i18n/admin-questions'

/**
 * `i18n/tr/admin-questions.json` içindeki `adminQuestions` bölümünün şekli.
 * Tipli okunur; silinen bir anahtar derleme zamanında görünür.
 */
export type AdminQuestionStrings = {
  title: string
  description: string
  new: string
  import: string

  filterTitle: string
  searchLabel: string
  searchPlaceholder: string
  examLabel: string
  subjectLabel: string
  topicLabel: string
  difficultyLabel: string
  publishedLabel: string
  all: string
  apply: string
  reset: string
  publishedOnly: string
  draftOnly: string

  colStem: string
  colTopic: string
  colDifficulty: string
  colStatus: string
  colUsage: string
  colUpdated: string
  usedInTest: string
  notUsed: string
  published: string
  draft: string
  optionCount: string

  emptyTitle: string
  emptyDescription: string
  noResultsTitle: string
  noResultsDescription: string
  resultCount: string
  pageInfo: string
  previousPage: string
  nextPage: string

  editorNewTitle: string
  editorEditTitle: string
  editorDescription: string
  stemLabel: string
  stemHint: string
  previewTitle: string
  previewEmpty: string
  previewLoading: string
  optionsLabel: string
  optionsHint: string
  optionText: string
  addOption: string
  removeOption: string
  moveUp: string
  moveDown: string
  correctLabel: string
  markCorrect: string
  explanationLabel: string
  explanationHint: string
  solutionVideoLabel: string
  difficultyFieldLabel: string
  expectedSecondsLabel: string
  expectedSecondsHint: string
  tagsLabel: string
  tagsHint: string
  outcomeLabel: string
  outcomeNone: string
  topicFieldLabel: string
  topicPlaceholder: string
  publishLabel: string
  publishHint: string
  imageLabel: string
  imageHint: string
  imageUpload: string
  imageRemove: string
  imageUploading: string
  imageUploadFailed: string
  imageWrongType: string
  imageTooLarge: string
  imagePreview: string
  save: string
  saving: string
  saved: string
  saveFailed: string
  deleteQuestion: string
  deleteConfirm: string
  deleted: string
  backToList: string
  notFound: string

  importTitle: string
  importDescription: string
  importFileLabel: string
  importFileHint: string
  importTemplate: string
  importColumns: string
  importAnalyze: string
  importAnalyzing: string
  importCommit: string
  importCommitting: string
  importPublishLabel: string
  importPublishHint: string
  importReadFailed: string
  importTooLarge: string
  importSummaryValid: string
  importSummaryErrors: string
  importNoValid: string
  importPreviewTitle: string
  importErrorsTitle: string
  importColLine: string
  importColColumn: string
  importColMessage: string
  importColStem: string
  importColTopic: string
  importColOptions: string
  importColCorrect: string
  importColDifficulty: string
  importDone: string
  importPartial: string
  importFailedTitle: string
  importAgain: string
  importPreviewMore: string
}

export function questionStrings(): AdminQuestionStrings {
  return section<AdminQuestionStrings>('adminQuestions')
}
