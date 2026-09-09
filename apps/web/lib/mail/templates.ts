import { APP_NAME } from '@/lib/env'
import { appUrl, greeting, renderEmail } from './layout'
import type { RenderedEmail } from './provider'

/**
 * Uygulamanın gönderdiği yedi e-posta şablonu (spec §M16).
 *
 * Her şablon SAF bir fonksiyondur: girdi alır, `{ subject, html, text }` döner.
 * Ne veritabanı okur, ne de sağlayıcı tanır — bu yüzden tamamı birim testiyle
 * doğrulanabilir.
 *
 * ── SUPABASE AUTH İLE SINIR ────────────────────────────────────────────────
 * E-posta doğrulama ve şifre sıfırlama akışlarını Supabase Auth'un kendisi
 * `supabase/templates/*.html` üzerinden gönderiyor. Buradaki iki karşılığı
 * (`verificationEmail`, `passwordResetEmail`) uygulamanın KENDİ tetiklediği
 * gönderimler içindir (ör. yönetim panelinden yeniden gönderme). İkisi de şu an
 * hiçbir yerden çağrılmıyor; şablon hazır, tetikleyici yok.
 *
 * ── DİL ────────────────────────────────────────────────────────────────────
 * Metinler Türkçe ve tam aksanlıdır; ürün adı `NEXT_PUBLIC_APP_NAME`ten gelir,
 * hiçbir şablona marka adı gömülmez.
 */

/* ------------------------------------------------------------------------- *
 * 1 — E-posta doğrulama
 * ------------------------------------------------------------------------- */

export type VerificationEmailInput = {
  name?: string | null
  /** Supabase'in ürettiği tek kullanımlık doğrulama bağlantısı. */
  verifyUrl: string
}

export function verificationEmail(input: VerificationEmailInput): RenderedEmail {
  return renderEmail({
    subject: `${APP_NAME} hesabınızı doğrulayın`,
    heading: 'E-posta adresinizi doğrulayın',
    paragraphs: [
      greeting(input.name),
      `${APP_NAME} hesabınızı kullanmaya başlamak için e-posta adresinizi doğrulamanız gerekiyor.`,
      'Bu bağlantı kısa süre sonra geçersiz olur. Bu hesabı siz açmadıysanız bu e-postayı yok sayabilirsiniz.',
    ],
    action: { label: 'Adresimi doğrula', url: input.verifyUrl },
  })
}

/* ------------------------------------------------------------------------- *
 * 2 — Şifre sıfırlama
 * ------------------------------------------------------------------------- */

export type PasswordResetEmailInput = {
  name?: string | null
  resetUrl: string
}

export function passwordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  return renderEmail({
    subject: `${APP_NAME} şifrenizi sıfırlayın`,
    heading: 'Şifrenizi sıfırlayın',
    paragraphs: [
      greeting(input.name),
      `${APP_NAME} hesabınız için şifre sıfırlama isteği aldık. Yeni şifrenizi belirlemek için aşağıdaki bağlantıyı kullanın.`,
      'Bu isteği siz yapmadıysanız hiçbir şey yapmanıza gerek yok; şifreniz değişmez.',
    ],
    action: { label: 'Yeni şifre belirle', url: input.resetUrl },
  })
}

/* ------------------------------------------------------------------------- *
 * 3 — Tekrar hatırlatma (cron: reminders)
 * ------------------------------------------------------------------------- */

export type ReviewReminderEmailInput = {
  name?: string | null
  /** Vadesi gelmiş kart sayısı; SUNUCUDA sayılır. */
  dueCount: number
}

export function reviewReminderEmail(input: ReviewReminderEmailInput): RenderedEmail {
  const count = Math.max(0, Math.trunc(input.dueCount))

  return renderEmail({
    subject: `${count} hafıza kartınızın tekrarı bekliyor`,
    heading: 'Tekrar zamanı geldi',
    paragraphs: [
      greeting(input.name),
      `Bugün tekrarı gelen ${count} hafıza kartınız var. Aralıklı tekrar, ancak zamanında yapıldığında işe yarar; 10 dakika bugün, bir saatlik çalışmayı ileride kurtarır.`,
    ],
    action: { label: 'Kartları tekrar et', url: appUrl('/kartlar') },
  })
}

/* ------------------------------------------------------------------------- *
 * 4 — Program hatırlatma
 * ------------------------------------------------------------------------- */

export type PlanReminderEmailInput = {
  name?: string | null
  /** Bugün için planlanmış, henüz tamamlanmamış blok sayısı. */
  pendingBlocks: number
  /** Türkçe gün etiketi (ör. "9 Eylül Salı"). */
  dayLabel: string
  /** Programdaki toplam dakika. */
  minutes?: number
}

export function planReminderEmail(input: PlanReminderEmailInput): RenderedEmail {
  const blocks = Math.max(0, Math.trunc(input.pendingBlocks))
  const minutes = input.minutes === undefined ? null : Math.max(0, Math.trunc(input.minutes))

  return renderEmail({
    subject: `Bugünkü programınızda ${blocks} adım kaldı`,
    heading: `${input.dayLabel} programınız`,
    paragraphs: [
      greeting(input.name),
      minutes === null
        ? `Bugün için planlanmış ${blocks} çalışma bloğunuz henüz tamamlanmadı.`
        : `Bugün için planlanmış ${blocks} çalışma bloğunuz henüz tamamlanmadı; toplam ${minutes} dakika sürüyor.`,
      'Programı olduğu gibi uygulamak zorunda değilsiniz — bir bloğu bitirmek bile seriyi ayakta tutar.',
    ],
    action: { label: 'Programımı aç', url: appUrl('/program') },
  })
}

/* ------------------------------------------------------------------------- *
 * 5 — Soru yanıtlandı
 * ------------------------------------------------------------------------- */

export type QuestionAnsweredEmailInput = {
  name?: string | null
  /** Sorunun dersi; bilinmiyorsa boş bırakılabilir. */
  subjectName?: string | null
  /** `help_requests.id` — bağlantı buradan kurulur. */
  requestId: string
}

export function questionAnsweredEmail(input: QuestionAnsweredEmailInput): RenderedEmail {
  const subject = (input.subjectName ?? '').trim()

  return renderEmail({
    subject: subject === '' ? 'Sorunuz yanıtlandı' : `${subject} sorunuz yanıtlandı`,
    heading: 'Öğretmeniniz sorunuzu yanıtladı',
    paragraphs: [
      greeting(input.name),
      subject === ''
        ? 'Sorduğunuz soruya bir yanıt geldi.'
        : `${subject} dersinde sorduğunuz soruya bir yanıt geldi.`,
      'Yanıtı okuduktan sonra anlamadığınız bir yer kalırsa aynı soru altından devam edebilirsiniz.',
    ],
    action: { label: 'Yanıtı gör', url: appUrl(`/soru-sor/${input.requestId}`) },
  })
}

/* ------------------------------------------------------------------------- *
 * 6 — Veli haftalık özet (cron: parent-summary)
 * ------------------------------------------------------------------------- */

export type ParentWeeklySummaryEmailInput = {
  parentName?: string | null
  /** Öğrencinin görünen adı; bilinmiyorsa "öğrenciniz" yazılır. */
  studentName?: string | null
  /** Hafta aralığı etiketi (ör. "1 – 7 Eylül"). */
  weekLabel: string
  studyMinutes: number
  questionsAnswered: number
  videosCompleted: number
  /** Doğruluk yüzdesi; hiç soru çözülmediyse null. */
  accuracyPercent: number | null
  /** Veli panelindeki rapora giden göreli yol. */
  reportPath: string
}

export function parentWeeklySummaryEmail(input: ParentWeeklySummaryEmailInput): RenderedEmail {
  const student = (input.studentName ?? '').trim() || 'Öğrenciniz'

  return renderEmail({
    subject: `${student} için haftalık özet (${input.weekLabel})`,
    heading: `${student} — ${input.weekLabel} haftası`,
    paragraphs: [
      greeting(input.parentName),
      `Geçen haftanın özeti aşağıda. Sayılar tek başına bir başarı ölçüsü değil; eğilimi görmek için veli panelindeki karşılaştırmaya bakmanızı öneririz.`,
    ],
    facts: [
      { label: 'Çalışma süresi', value: `${Math.max(0, Math.trunc(input.studyMinutes))} dakika` },
      { label: 'Çözülen soru', value: `${Math.max(0, Math.trunc(input.questionsAnswered))}` },
      { label: 'İzlenen video', value: `${Math.max(0, Math.trunc(input.videosCompleted))}` },
      {
        label: 'Doğruluk',
        value: input.accuracyPercent === null ? 'ölçülmedi' : `%${input.accuracyPercent}`,
      },
    ],
    action: { label: 'Haftalık raporu aç', url: appUrl(input.reportPath) },
  })
}

/* ------------------------------------------------------------------------- *
 * 7 — Abonelik bitiyor
 * ------------------------------------------------------------------------- */

export type SubscriptionEndingEmailInput = {
  name?: string | null
  packageName: string
  /** Bitişe kalan tam gün. */
  daysLeft: number
  /** Türkçe tarih etiketi (ör. "16 Eylül 2026"). */
  endsAtLabel: string
}

export function subscriptionEndingEmail(input: SubscriptionEndingEmailInput): RenderedEmail {
  const days = Math.max(0, Math.trunc(input.daysLeft))

  return renderEmail({
    subject:
      days === 0
        ? `${input.packageName} aboneliğiniz bugün sona eriyor`
        : `${input.packageName} aboneliğinizin bitmesine ${days} gün kaldı`,
    heading: 'Aboneliğiniz sona ermek üzere',
    paragraphs: [
      greeting(input.name),
      days === 0
        ? `${input.packageName} aboneliğiniz bugün (${input.endsAtLabel}) sona eriyor.`
        : `${input.packageName} aboneliğiniz ${input.endsAtLabel} tarihinde sona eriyor; ${days} gün kaldı.`,
      'Abonelik bittiğinde çalışma geçmişiniz, yetkinlik haritanız ve hafıza kartlarınız silinmez — yalnızca kilitli içeriklere erişiminiz durur.',
    ],
    action: { label: 'Aboneliğimi yönet', url: appUrl('/ayarlar') },
  })
}
