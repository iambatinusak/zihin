import type { SeedBadge, SeedPackage, SeedUser } from './types'

/**
 * Müfredat dışındaki sabit seed verisi: rozetler, paketler ve test hesapları.
 * Müfredat ağacı `seed/curriculum/`, ders içeriği `seed/content/` altındadır.
 */

// ---------------------------------------------------------------------------
// Rozetler (şartname §M13)
// ---------------------------------------------------------------------------

export const badges: SeedBadge[] = [
  {
    code: 'first_video',
    name: 'İlk Adım',
    description: 'İlk konu anlatım videonu tamamladın. Başlamak en zor kısmıydı.',
    icon: 'PlayCircle',
    rule: { metric: 'videos_completed', threshold: 1 },
    orderIndex: 0,
  },
  {
    code: 'ten_tests',
    name: 'On Test',
    description: 'On konu testini bitirdin. Artık hangi konuda nerede olduğun ölçülebilir.',
    icon: 'ClipboardCheck',
    rule: { metric: 'tests_completed', threshold: 10 },
    orderIndex: 1,
  },
  {
    code: 'streak_7',
    name: 'Yedi Gün',
    description: 'Yedi gün üst üste en az 15 dakika çalıştın. Alışkanlık burada başlar.',
    icon: 'Flame',
    rule: { metric: 'current_streak', threshold: 7 },
    orderIndex: 2,
  },
  {
    code: 'streak_30',
    name: 'Otuz Gün',
    description: 'Bir ay boyunca hiç ara vermedin. Bu artık bir rutin.',
    icon: 'CalendarCheck',
    rule: { metric: 'current_streak', threshold: 30 },
    orderIndex: 3,
  },
  {
    code: 'first_mock',
    name: 'İlk Deneme',
    description: 'İlk deneme sınavını çözdün. Gerçek sınav provası tamam.',
    icon: 'Timer',
    rule: { metric: 'mocks_completed', threshold: 1 },
    orderIndex: 4,
  },
  {
    code: 'weak_to_strong',
    name: 'Zayıftan Güçlüye',
    description: 'Zayıf görünen bir konuyu güçlü seviyeye çıkardın. En değerli rozet bu.',
    icon: 'TrendingUp',
    rule: { metric: 'weak_to_strong_count', threshold: 1 },
    orderIndex: 5,
  },
  {
    code: 'hundred_cards',
    name: 'Yüz Kart',
    description: 'Yüz hafıza kartı tekrarı yaptın. Öğrendiğin kalıcı hâle geliyor.',
    icon: 'Layers',
    rule: { metric: 'cards_reviewed', threshold: 100 },
    orderIndex: 6,
  },
]

// ---------------------------------------------------------------------------
// Paketler (şartname §M14)
// ---------------------------------------------------------------------------

export const packages: SeedPackage[] = [
  {
    examCode: 'LGS',
    name: 'LGS Yıllık',
    description:
      'Tüm LGS derslerinde konu anlatım videoları, konu testleri, deneme sınavları ve hafıza kartları. Bir yıl boyunca sınırsız erişim.',
    durationDays: 365,
    priceTry: 2490,
    features: { daily_question_limit: 3, mock_exam_access: true, coaching: false },
    orderIndex: 0,
  },
  {
    examCode: 'TYT',
    name: 'TYT Yıllık',
    description:
      'TYT’nin on dersinin tamamı: konu anlatımı, akıllı test paneli, kişisel çalışma programı ve deneme sınavları.',
    durationDays: 365,
    priceTry: 2990,
    features: { daily_question_limit: 3, mock_exam_access: true, coaching: false },
    orderIndex: 1,
  },
  {
    examCode: 'AYT',
    name: 'TYT + AYT Yıllık',
    description:
      'TYT ve AYT içeriklerinin tamamı, öğretmen desteği ve günde 5 soru sorma hakkı. Sayısal, eşit ağırlık ve sözel alanların hepsini kapsar.',
    durationDays: 365,
    priceTry: 4490,
    features: { daily_question_limit: 5, mock_exam_access: true, coaching: true },
    orderIndex: 2,
  },
  {
    examCode: 'KPSS_LISANS',
    name: 'KPSS 6 Ay',
    description:
      'KPSS Lisans Genel Yetenek ve Genel Kültür konuları, güncel bilgiler bölümü ve deneme sınavları. Altı aylık yoğun hazırlık paketi.',
    durationDays: 180,
    priceTry: 1990,
    features: { daily_question_limit: 3, mock_exam_access: true, coaching: false },
    orderIndex: 3,
  },
]

// ---------------------------------------------------------------------------
// Test hesapları (şartname §11)
// ---------------------------------------------------------------------------

/**
 * Yalnızca geliştirme ve demo içindir. Üretim seed’inde çalıştırılmaz —
 * `seed/index.ts` bunu `NODE_ENV !== 'production'` koşuluna bağlar.
 */
export const TEST_PASSWORD = 'Test1234!'

export const testUsers: SeedUser[] = [
  {
    email: 'ogrenci@test.com',
    password: TEST_PASSWORD,
    role: 'student',
    fullName: 'Elif Yılmaz',
    displayName: 'Elif',
    grade: '12',
    examCode: 'TYT',
    dailyMinutes: 120,
  },
  {
    email: 'veli@test.com',
    password: TEST_PASSWORD,
    role: 'parent',
    fullName: 'Ayşe Yılmaz',
    displayName: 'Ayşe Hanım',
  },
  {
    email: 'ogretmen@test.com',
    password: TEST_PASSWORD,
    role: 'teacher',
    fullName: 'Murat Demir',
    displayName: 'Murat Öğretmen',
  },
  {
    email: 'editor@test.com',
    password: TEST_PASSWORD,
    role: 'editor',
    fullName: 'Zeynep Kaya',
    displayName: 'Zeynep',
  },
  {
    email: 'admin@test.com',
    password: TEST_PASSWORD,
    role: 'admin',
    fullName: 'Sistem Yöneticisi',
    displayName: 'Yönetici',
  },
]

// ---------------------------------------------------------------------------
// Demo aktivite geçmişi ayarları
// ---------------------------------------------------------------------------

/**
 * Öğrenci hesabı için üretilecek iki haftalık gerçekçi geçmişin parametreleri.
 * Amaç: panellerin boş gelmemesi ve yetkinlik motorunun anlamlı bir dağılım
 * üretmesi. Rastgelelik tohumlu (deterministik) olmalıdır ki seed her
 * çalıştığında aynı veriyi üretsin.
 */
export const DEMO_ACTIVITY = {
  /** Kaç gün geriye dönük geçmiş üretilecek. */
  days: 14,
  /** Öğrencinin çalıştığı gün oranı (0-1). */
  activeDayRatio: 0.8,
  /** Bir çalışma gününde çözülen soru sayısı aralığı. */
  questionsPerDay: [12, 40] as const,
  /**
   * Konuların yetkinlik dağılımı — gerçekçi bir öğrenci profili:
   * bazı konular güçlü, çoğu orta, birkaçı zayıf, geri kalanı hiç çalışılmamış.
   */
  masteryProfile: {
    strong: 0.15,
    medium: 0.35,
    weak: 0.2,
    untouched: 0.3,
  },
  /** Deterministik rastgelelik için tohum. */
  seed: 20260908,
} as const
