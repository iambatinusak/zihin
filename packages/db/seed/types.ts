/**
 * Seed veri modeli.
 *
 * Bu tipler veritabani satirlarinin birebir kopyasi degildir: id, timestamp ve
 * yabanci anahtarlar yukleme sirasinda uretilir. Icerik yazarken yalnizca
 * anlamli alanlar doldurulur, geri kalanini `seed/index.ts` baglar.
 *
 * Icerik kurallari (sartname §11):
 *  - Tum icerik OZGUNDUR. Hicbir yayinevinin, kurumun ya da rakip platformun
 *    metni, sorusu veya gorseli kullanilmaz.
 *  - Konu basliklari gercek MEB/OSYM mufredatini yansitir (baslik bir olgudur,
 *    telifli bir metin degildir).
 *  - Sorular "cikmis soru" DEGIL, cikmis soru TARZINDA ozgun sorulardir
 *    (`source: 'exam_style'`), ya da tamamen ozgun (`source: 'original'`).
 */

// ---------------------------------------------------------------------------
// Mufredat agaci
// ---------------------------------------------------------------------------

export type SeedExam = {
  /** 'LGS' | 'TYT' | 'AYT' | 'KPSS_LISANS' | 'DGS' | 'ALES' */
  code: string
  name: string
  description: string
  /** LGS'de 3, digerlerinde 4 yanlis 1 dogruyu goturur. */
  wrongPenaltyDivisor: 3 | 4
  /** ISO tarih (YYYY-MM-DD). Admin panelinden guncellenir. */
  defaultExamDate: string
  totalQuestions: number
  durationMinutes: number
  orderIndex: number
  subjects: SeedSubject[]
}

export type SeedSubject = {
  name: string
  slug: string
  orderIndex: number
  /** Isi haritasi rengi, Tailwind HSL formati: "243 75% 52%". */
  color: string
  /** Sinavda bu dersten cikan soru sayisi. */
  questionCount: number
  units: SeedUnit[]
}

export type SeedUnit = {
  name: string
  slug: string
  orderIndex: number
  topics: SeedTopic[]
}

export type SeedTopic = {
  title: string
  slug: string
  orderIndex: number
  /** Konunun video + calisma suresi tahmini (dakika). */
  estimatedMinutes: number
  /** 1 (kolay) - 5 (zor). */
  difficulty: number
  /** 0-1 arasi, sinavda cikma agirligi. Onceliklendirmede carpan. */
  examWeight: number
  /**
   * Hafiza teknigi notu (markdown, en az 5 cumle).
   * Gercek bir teknik icermeli: kisaltma (akrostis), hikayeleme, loci,
   * gorsel esleme ya da sayi-sekil sistemi. Genel "iyi calis" ogutleri degil.
   */
  memoryNote: string
  outcomes: SeedOutcome[]
  videos: SeedVideo[]
  questions: SeedQuestion[]
  flashcards: SeedFlashcard[]
}

export type SeedOutcome = {
  /** MEB kazanim kodu, orn. "M.9.1.1.1". */
  code: string
  description: string
  orderIndex: number
}

// ---------------------------------------------------------------------------
// Icerik
// ---------------------------------------------------------------------------

export type SeedVideo = {
  title: string
  type: 'lecture' | 'solution' | 'summary'
  durationSeconds: number
  orderIndex: number
  /** Abonelik olmadan izlenebilir mi (her konuda ilk 2 video ucretsiz). */
  isFreePreview: boolean
  /**
   * Video ici interaktif sorular.
   * `questionIndex`, ayni konunun `questions` dizisindeki 0 tabanli sirasidir.
   */
  checkpoints: SeedCheckpoint[]
}

export type SeedCheckpoint = {
  timestampSeconds: number
  questionIndex: number
}

export type SeedQuestionOption = {
  /** 'A' | 'B' | 'C' | 'D' | 'E' */
  key: string
  /** Markdown + LaTeX ($...$) desteklenir. */
  text: string
}

export type SeedQuestion = {
  /** Soru koku. Markdown + KaTeX. */
  stem: string
  options: SeedQuestionOption[]
  /** `options` icindeki bir `key` degeri olmak zorunda. */
  correctOption: string
  /** Cozum aciklamasi (markdown). Neden dogru oldugunu anlatir. */
  explanation: string
  /** 1-5. Konu basina dagilim: 2 adet 1-2, 4 adet 3, 4 adet 4, 2 adet 5. */
  difficulty: number
  /** Beklenen cozum suresi (saniye). Bos birakilirsa 60 + 20*difficulty. */
  expectedSeconds: number
  tags: string[]
  source: 'original' | 'exam_style'
  /** Bagli kazanim kodu (varsa). */
  outcomeCode?: string
}

export type SeedFlashcard = {
  /** Kart on yuzu — soru ya da ipucu. Markdown. */
  front: string
  /** Kart arka yuzu — cevap. Markdown. */
  back: string
}

// ---------------------------------------------------------------------------
// Icerik paketi — bir dersin tum derin icerigi
// ---------------------------------------------------------------------------

/**
 * Bir dersin icerigi ayri dosyada tutulur ve `slug` uzerinden mufredat
 * agacina baglanir. Boylece agac (yapisal) ve icerik (hacimli) ayri ayri
 * gozden gecirilebilir.
 */
export type SeedSubjectContent = {
  examCode: string
  subjectSlug: string
  units: Array<{
    slug: string
    topics: Array<
      Pick<SeedTopic, 'slug' | 'memoryNote' | 'outcomes' | 'videos' | 'questions' | 'flashcards'>
    >
  }>
}

// ---------------------------------------------------------------------------
// Diger seed varliklari
// ---------------------------------------------------------------------------

export type SeedBadge = {
  code: string
  name: string
  description: string
  /** lucide-react ikon adi. */
  icon: string
  rule: { metric: string; threshold: number }
  orderIndex: number
}

export type SeedPackage = {
  examCode: string
  name: string
  description: string
  durationDays: number
  priceTry: number
  features: {
    daily_question_limit: number
    mock_exam_access: boolean
    coaching: boolean
  }
  orderIndex: number
}

export type SeedUser = {
  email: string
  password: string
  role: 'student' | 'parent' | 'teacher' | 'editor' | 'admin'
  fullName: string
  displayName: string
  grade?: string
  examCode?: string
  dailyMinutes?: number
}
