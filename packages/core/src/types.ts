/**
 * @zihin/core — paylasilan alan tipleri.
 *
 * Bu dosya cekirdek is mantiginin SOZLESMESIDIR. Veritabani satirlarini birebir
 * yansitmaz; her fonksiyonun ihtiyac duydugu en az bilgiyi tanimlar. Boylece
 * core, sema degisikliklerinden yalitilir ve testlerde kolayca beslenir.
 *
 * Tarih/saat kurallari:
 *  - Fonksiyonlar `Date` alir ve `Date` doner; ISO string kabul edilen yerlerde
 *    acikca `Date | string` yazilmistir.
 *  - "Gun" kavraminin gectigi her yerde (streak, program, tekrar takvimi)
 *    referans saat dilimi Turkiye'dir (UTC+3, yaz saati uygulanmaz).
 */

// ---------------------------------------------------------------------------
// Yetkinlik (mastery)
// ---------------------------------------------------------------------------

/** Yetkinlik siniflandirmasi. `unknown` = yeterli veri yok (n < 3). */
export type MasteryStatus = 'unknown' | 'weak' | 'medium' | 'strong'

/** Bir cozum denemesinin yetkinlik hesabi icin gereken en az bilgisi. */
export type AttemptLike = {
  /** Sorunun kimligi — ayni sorunun tekrar cozulmesini saptamak icin. */
  questionId: string
  isCorrect: boolean
  /** 1-5. Aralik disi degerler hesaplamada kirpilir. */
  difficulty: number
  timeSpentMs: number
  /** Sorunun beklenen cozum suresi. null ise `60 + 20 * difficulty` varsayilir. */
  expectedSeconds: number | null
  answeredAt: Date | string
  /**
   * Ayni sorunun kacinci cozumu (0 = ilk). Verilmezse fonksiyon listeyi
   * kendisi tarayip hesaplar. 0'dan buyuk tekrarlar dusuk agirlik alir.
   */
  repeatIndex?: number
}

export type MasteryResult = {
  /** 0-100 arasi tam sayi. */
  mastery: number
  status: MasteryStatus
  /** Hesaba giren deneme sayisi. */
  n: number
}

/** Onceliklendirme icin gereken konu bilgisi. */
export type TopicLike = {
  id: string
  subjectId: string
  unitId: string
  title: string
  /** Mufredat sirasi (kucukten buyuge). */
  orderIndex: number
  estimatedMinutes: number
  /** 1-5 */
  difficulty: number
  /** 0-1 arasi, sinavda cikma agirligi. */
  examWeight: number
}

export type MasteryEntry = {
  topicId: string
  mastery: number
  status: MasteryStatus
  attemptsCount: number
}

export type PriorityTopic = {
  topic: TopicLike
  mastery: number
  status: MasteryStatus
  /** priority = (100 - mastery) * examWeight * (1 + 0.2 * difficulty) */
  priority: number
}

// ---------------------------------------------------------------------------
// Calisma programi
// ---------------------------------------------------------------------------

export type StudyBlockType = 'watch' | 'solve' | 'review' | 'mock'

/** Hazir program sablonlari. */
export type PlanTemplate = 'balanced' | 'video_only' | 'test_only' | 'last_30_days'

export type PlanInput = {
  /** Plan hangi gunden itibaren uretilecek (dahil). */
  startDate: Date
  /** Hedef sinav tarihi. Gecmisse plan tek haftaya sikistirilir. */
  examDate: Date
  /** Gunluk calisma butcesi (dakika). */
  dailyMinutes: number
  /** Haftanin calisilabilir gunleri. 1 = Pazartesi ... 7 = Pazar. */
  studyDays: number[]
  topics: TopicLike[]
  masteries: MasteryEntry[]
  template?: PlanTemplate
  /** Kac haftalik plan uretilecek. Varsayilan 1 (icinde bulunulan hafta). */
  weeks?: number
}

export type StudyBlockDraft = {
  /** ISO tarih (YYYY-MM-DD). */
  scheduledDate: string
  orderIndex: number
  type: StudyBlockType
  topicId: string | null
  estimatedMinutes: number
  /** Kullaniciya gosterilecek Turkce baslik. */
  title: string
}

export type StudyPlanResult = {
  blocks: StudyBlockDraft[]
  /** Program sigmadiginda kullaniciya gosterilecek Turkce uyarilar. */
  warnings: string[]
  /** Programin kapsadigi konu sayisi ve toplam dakika. */
  stats: {
    topicCount: number
    totalMinutes: number
    weeklyBudgetMinutes: number
    weeksRemaining: number
  }
}

// ---------------------------------------------------------------------------
// Aralikli tekrar (SM-2)
// ---------------------------------------------------------------------------

/** SM-2 puani. UI'da 4 buton: Tekrar=1, Zor=3, Iyi=4, Kolay=5. */
export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5

export type CardState = {
  easeFactor: number
  intervalDays: number
  repetitions: number
  nextReviewAt: Date
  lastGrade: ReviewGrade | null
}

// ---------------------------------------------------------------------------
// Puanlama (net, deneme, yuzdelik)
// ---------------------------------------------------------------------------

/** Sinav tipine gore yanlis katsayisi: TYT/AYT/KPSS/DGS/ALES = 4, LGS = 3. */
export type WrongPenaltyDivisor = 3 | 4

export type MockSectionInput = {
  subjectId: string
  subjectName: string
  questionIds: string[]
}

export type MockAttemptInput = {
  questionId: string
  selectedOption: string | null
  isCorrect: boolean
  topicId: string
}

export type MockSectionSummary = {
  subjectId: string
  subjectName: string
  total: number
  correct: number
  wrong: number
  blank: number
  net: number
}

export type MockSummary = {
  sections: MockSectionSummary[]
  total: number
  correct: number
  wrong: number
  blank: number
  net: number
  /** Konu bazli kirilim — mastery motoruna beslenir. */
  byTopic: Array<{ topicId: string; total: number; correct: number }>
  durationSeconds: number | null
}

// ---------------------------------------------------------------------------
// Oyunlastirma
// ---------------------------------------------------------------------------

export type XpReason =
  | 'video_completed'
  | 'test_completed'
  | 'correct_answer'
  | 'card_reviewed'
  | 'block_completed'
  | 'mock_completed'
  | 'placement_completed'

export type XpEvent = {
  reason: XpReason
  /** Sayiya bagli olaylarda adet (dogru cevap sayisi, kart sayisi vb.). */
  count?: number
}

export type StreakState = {
  currentStreak: number
  longestStreak: number
  /** ISO tarih (YYYY-MM-DD), Turkiye saatine gore. */
  lastStudyDate: string | null
  /** Bu cagri seriyi artirdi mi (XP/rozet tetigi icin). */
  incremented: boolean
}

export type StreakProfile = {
  currentStreak: number
  longestStreak: number
  lastStudyDate: string | null
}

export type BadgeCode =
  | 'first_video'
  | 'ten_tests'
  | 'streak_7'
  | 'streak_30'
  | 'first_mock'
  | 'weak_to_strong'
  | 'hundred_cards'

export type BadgeContext = {
  videosCompleted: number
  testsCompleted: number
  currentStreak: number
  mocksCompleted: number
  cardsReviewed: number
  /** Zayiftan gucluye cikarilan konu sayisi. */
  weakToStrongCount: number
  /** Kullanicinin zaten sahip oldugu rozetler — tekrar verilmez. */
  earnedBadges: BadgeCode[]
}

export type LevelInfo = {
  level: number
  /** Bu seviyenin baslangic XP'si. */
  currentLevelXp: number
  /** Bir sonraki seviye icin gereken toplam XP. null = son seviye. */
  nextLevelXp: number | null
  /** Bu seviye icindeki ilerleme (0-1). */
  progress: number
}
