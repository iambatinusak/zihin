/**
 * Uçtan uca testlerin tohum (seed) verisine dair TEK VARSAYIM DOSYASI.
 *
 * Kural: bir spec dosyası e-posta, slug ya da başlık metnini kendi içine
 * yazmaz; hepsi buradan okunur. Tohum değişirse üç spec değil bu dosya kırılır
 * ve düzeltme tek yerde yapılır.
 *
 * Doğrulanabilir kaynaklar:
 *   packages/db/seed/static.ts                       → test hesapları, şifre
 *   packages/db/seed/curriculum/lgs.ts               → LGS ders/ünite/konu adları
 *   packages/db/seed/content/lgs-turkce-sozcukte-anlam.ts → içeriği OLAN tek dal
 */

/** Tohumdaki tüm demo hesaplarının ortak şifresi (`seed/static.ts`). */
export const TEST_PASSWORD = 'Test1234!'

export const ACCOUNTS = {
  student: 'ogrenci@test.com',
  parent: 'veli@test.com',
  teacher: 'ogretmen@test.com',
  editor: 'editor@test.com',
  admin: 'admin@test.com',
} as const

export type AccountRole = keyof typeof ACCOUNTS

/**
 * İÇERİĞİ OLAN TEK DAL.
 *
 * 1164 konudan yalnızca üçünde video/soru/kart var ve üçü de burada:
 * LGS → Türkçe → Sözcükte Anlam. Tohum betiği (`seed/index.ts`) demo
 * öğrencisini bilerek İÇERİĞİ OLAN sınava atar — bu yüzden `ogrenci@test.com`
 * hesabının hedef sınavı LGS'tir, `static.ts` içindeki `examCode: 'TYT'`
 * değeri değil. Testler bu yüzden LGS dalını kullanır.
 */
export const CONTENT = {
  examName: 'LGS — Liselere Geçiş Sınavı',
  subjectName: 'Türkçe',
  subjectSlug: 'turkce',
  unitName: 'Sözcükte Anlam',
  unitSlug: 'sozcukte-anlam',
  /** İçeriği olan üç konudan ilki; tüm gezinme buradan yapılır. */
  topicTitle: 'Gerçek, Mecaz ve Terim Anlam',
  topicSlug: 'gercek-mecaz-ve-terim-anlam',
  /** Konu testi başlığı tohumda `"<konu> — Konu Testi"` kalıbıyla üretilir. */
  topicTestTitle: 'Gerçek, Mecaz ve Terim Anlam — Konu Testi',
} as const

/**
 * Yeni kayıt olan öğrencinin sihirbazda seçeceği sınav.
 * İçeriği olan sınav seçilir; aksi hâlde seviye tespit havuzu boş kalır
 * ("Bu sınav için henüz soru yok") ve öncelikli konular hiç oluşmaz.
 */
export const ONBOARDING = {
  examName: CONTENT.examName,
  gradeLabel: '8. sınıf',
} as const

/** Deneme sonucunda yüzdelik dilimin açılması için gereken katılımcı sayısı. */
export const MIN_PERCENTILE_SAMPLE = 20

/** LGS'de üç yanlış bir doğruyu götürür (`seed/curriculum/lgs.ts`). */
export const LGS_WRONG_PENALTY_DIVISOR = 3

/** Testlerin çakışmaması için her koşuma özgü e-posta üretir. */
export function uniqueEmail(prefix = 'e2e'): string {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return `${prefix}-${stamp}@ornek.test`
}
