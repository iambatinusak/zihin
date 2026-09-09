/**
 * Yapay zekâ sohbet asistanı — MVP KAPSAMI DIŞINDA (şartname §2.2).
 *
 * Şartname bu özelliğin yapılmamasını, ama "servis arayüzünün boş
 * bırakılmasını" istiyor. Amaç şu: asistan sonradan eklendiğinde uygulamanın
 * geri kalanının değişmesi gerekmesin. Arayüz burada, uygulaması yok.
 *
 * Bilinçli olarak somut bir LLM sağlayıcısına bağlanmıyor: `lib/video/provider.ts`
 * ve `lib/billing/provider.ts` ile aynı kalıp — arayüz uygulamanın ihtiyacını
 * tarif eder, sağlayıcı sonradan seçilir.
 */

/** Asistanın öğrenci bağlamını görmesi için gereken en az bilgi. */
export type AssistantContext = {
  userId: string
  /** Hangi sınava hazırlanıyor (LGS, TYT, ...). */
  examCode: string | null
  /** Sohbet bir konu sayfasından açıldıysa o konu. */
  topicId?: string
  /** Öğrencinin zayıf konuları — asistan buna göre yönlendirebilir. */
  weakTopicIds?: string[]
}

export type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export type AssistantReply = {
  content: string
  /** Asistanın önerdiği konular — arayüzde bağlantıya dönüşür. */
  suggestedTopicIds?: string[]
}

/**
 * Asistan servisi sözleşmesi.
 *
 * Uygulanırken dikkat edilecekler (şimdiden yazılı, çünkü uygulayan kişi
 * bunları bilmeden doğru yapamaz):
 *  - Asistan ASLA `questions.correct_option` ya da `explanation` görmemeli;
 *    aksi hâlde öğrenci ona test sorusunun cevabını sordurur.
 *  - Yanıtlar `attempts` tablosuna yazılmaz — asistan ölçme aracı değildir.
 *  - Kullanım paket bazlı sınırlanmalı (`packages.features`), tıpkı
 *    "soru sor" günlük kotası gibi.
 */
export interface IAssistantService {
  /** Tek turlu soru-cevap. */
  ask(context: AssistantContext, question: string): Promise<AssistantReply>

  /** Çok turlu sohbet; geçmiş çağıran tarafından taşınır. */
  chat(
    context: AssistantContext,
    history: readonly AssistantMessage[],
    question: string,
  ): Promise<AssistantReply>

  /** Sağlayıcı yapılandırılmış mı — arayüz özelliği gizlemek için sorar. */
  isAvailable(): boolean
}

/**
 * MVP'de tek uygulama bu: özellik kapalı.
 * Arayüzü çağıran kod `isAvailable()` ile korunmalı; yine de yanlışlıkla
 * çağrılırsa sessizce boş dönmek yerine açık bir hata verir.
 */
export const disabledAssistant: IAssistantService = {
  isAvailable: () => false,
  async ask() {
    throw new Error('Yapay zekâ asistanı bu sürümde kullanılamıyor.')
  },
  async chat() {
    throw new Error('Yapay zekâ asistanı bu sürümde kullanılamıyor.')
  },
}

/** Tek giriş noktası. Sağlayıcı eklendiğinde yalnızca burası değişir. */
export function getAssistantService(): IAssistantService {
  return disabledAssistant
}
