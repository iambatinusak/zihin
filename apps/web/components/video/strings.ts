/**
 * `i18n/tr/video.json` içindeki `video` bölümünün şekli.
 * `section<VideoStrings>('video')` çağrıları böylece tipli okunur ve eksik
 * anahtar derleme zamanında fark edilir.
 *
 * Metinler sunucuda okunup istemci bileşenlerine prop olarak geçirilir:
 * sözlüğün tamamı paketlenmez, yalnızca kullanılan bölüm gider.
 */
export type VideoStrings = {
  title: string
  backToTopic: string
  notesTitle: string
  notesEmpty: string
  notesHint: string
  addNote: string
  editNote: string
  deleteNote: string
  noteSaved: string
  noteDeleted: string
  notePlaceholder: string
  noteAtTime: string
  checkpointTitle: string
  checkpointHint: string
  /** Checkpoint sorusunun görselinin alternatif metni. */
  checkpointImage: string
  checkpointAnswer: string
  checkpointSkip: string
  checkpointSkipped: string
  checkpointCorrect: string
  checkpointWrong: string
  checkpointCorrectOption: string
  checkpointExplanation: string
  checkpointContinue: string
  progressTitle: string
  progressResume: string
  progressResumeAt: string
  progressStartOver: string
  completed: string
  completedToast: string
  completedAlready: string
  duration: string
  freePreview: string
  locked: string
  lockedAction: string
  loading: string
  playerError: string
  linkExpired: string
  refreshLink: string
  emptyTitle: string
  emptyDescription: string
  types: { lecture: string; solution: string; summary: string }

  tabs: { notes: string; outcomes: string; memoryNote: string }
  outcomesEmpty: string
  memoryNoteEmpty: string
  otherVideos: string
  otherVideosEmpty: string
  currentVideo: string
  sidePanel: string
  lockedTitle: string
  lockedDescription: string
  unavailableTitle: string
  noteAdd: string
  noteEmptyBody: string
  noteCounter: string
  noteSeek: string
  noteEditLabel: string
  noteDeleteLabel: string
  noteDeleteConfirm: string
  noteUpdated: string
  noteList: string

  player: {
    label: string
    play: string
    pause: string
    rewind: string
    forward: string
    mute: string
    unmute: string
    volume: string
    volumeValue: string
    rate: string
    rateValue: string
    fullscreen: string
    exitFullscreen: string
    seek: string
    seekValue: string
    elapsed: string
    total: string
    checkpointTick: string
    resumed: string
    liveRegion: string
  }

  shortcuts: {
    open: string
    title: string
    hint: string
    playPause: string
    seekBack: string
    seekForward: string
    volumeUp: string
    volumeDown: string
    mute: string
    fullscreen: string
    percent: string
    keySpace: string
    keyArrows: string
    keyVolume: string
    keyDigits: string
  }
}
