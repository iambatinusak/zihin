/**
 * Denemenin ders bölümleri (spec §M10, ekran §9.12).
 *
 * Bir deneme konu testinden şurada ayrılır: sorular `test_questions.section`
 * ile ders bölümlerine ayrılmıştır (Türkçe, Matematik, ...). Çözme ekranındaki
 * sekmeler, soru ızgarası ve sonuçtaki ders kırılımı bu gruplamadan doğar.
 *
 * Bu dosya saf: ne Supabase, ne React, ne `Date.now()`. `packages/core` yerine
 * burada durur çünkü `section` kolonunun serbest metin oluşu ve boş bölümün
 * nasıl görüneceği uygulamaya özgü sunum kararlarıdır (CONVENTIONS §5).
 */

/** Gruplama için bir sorunun gereken en az bilgisi. */
export type SectionedQuestion = {
  questionId: string
  /** `test_questions.section`; konu testlerinde ve eksik veride null. */
  section: string | null
}

export type MockSection = {
  /** Kararlı anahtar — sekme durumunda ve React `key`inde kullanılır. */
  key: string
  /** Kullanıcıya gösterilen ders adı. */
  name: string
  questionIds: string[]
}

/** Bölümü olmayan soruların toplandığı grubun anahtarı. */
export const UNSECTIONED_KEY = '__other__'

function normalise(section: string | null): string | null {
  if (typeof section !== 'string') return null
  const trimmed = section.trim()
  return trimmed.length === 0 ? null : trimmed
}

/**
 * Soruları ders bölümlerine ayırır.
 *
 * SIRA KORUNUR: bölümler ilk göründükleri sıraya göre dizilir, sorular da
 * verilen sıradadır. Deneme sınavında bölüm sırası anlamlıdır (TYT'de önce
 * Türkçe gelir), alfabetik sıralamak bunu bozardı.
 *
 * Bölümü boş olan sorular tek bir "diğer" grubunda toplanır — bölüm etiketi
 * eksik diye soru ekrandan kaybolmaz. Hiç bölüm bilgisi olmayan bir denemede
 * sonuç tek gruptur ve ekran yine doğru okunur.
 */
export function groupSections(
  questions: readonly SectionedQuestion[],
  fallbackName: string,
): MockSection[] {
  const sections: MockSection[] = []
  const byKey = new Map<string, MockSection>()

  for (const question of questions) {
    const name = normalise(question.section)
    const key = name ?? UNSECTIONED_KEY
    let group = byKey.get(key)
    if (!group) {
      group = { key, name: name ?? fallbackName, questionIds: [] }
      byKey.set(key, group)
      sections.push(group)
    }
    group.questionIds.push(question.questionId)
  }

  return sections
}

export type SectionProgress = {
  key: string
  name: string
  total: number
  answered: number
}

/**
 * Bölüm başına cevaplanan/toplam sayısı — sekme başlıklarındaki rozet.
 *
 * Şıkkı geri alınmış soru CEVAPLANMAMIŞ sayılır: `answers` haritasında değeri
 * `null` olan kayıt boş bırakılmış demektir. Hiç cevaplanmamış bir bölüm
 * `0/20` gösterir; bu boş bir sekme değil, henüz girilmemiş bir bölümdür.
 */
export function sectionProgress(
  sections: readonly MockSection[],
  answers: ReadonlyMap<string, string | null>,
): SectionProgress[] {
  return sections.map((section) => {
    let answered = 0
    for (const questionId of section.questionIds) {
      const answer = answers.get(questionId)
      if (answer !== undefined && answer !== null) answered += 1
    }
    return { key: section.key, name: section.name, total: section.questionIds.length, answered }
  })
}

/**
 * Bir sorunun hangi bölüme ait olduğu. Çözme ekranı, soru değiştikçe aktif
 * sekmeyi buna göre günceller.
 */
export function sectionKeyOfQuestion(
  sections: readonly MockSection[],
  questionId: string,
): string | null {
  for (const section of sections) {
    if (section.questionIds.includes(questionId)) return section.key
  }
  return null
}

/**
 * Denemenin genel ilerlemesi. Bölümlerin toplamıdır; oturumun soru sırasında
 * olmayan bir cevap buraya karışmaz.
 */
export function totalProgress(progress: readonly SectionProgress[]): {
  answered: number
  total: number
} {
  let answered = 0
  let total = 0
  for (const entry of progress) {
    answered += entry.answered
    total += entry.total
  }
  return { answered, total }
}
