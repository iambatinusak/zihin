/**
 * KVKK anonimleştirme alan eşlemesi (spec §10).
 *
 * ── NE SİLİNİR ─────────────────────────────────────────────────────────────
 *   profiles.full_name        → sabit, kimliksiz metin
 *   profiles.display_name     → sabit, kimliksiz metin
 *   profiles.avatar_url       → null (fotoğraf biyometrik olmasa da kişiseldir)
 *   profiles.invite_code      → null (veli davetini kişiye bağlayan tek iz)
 *   profiles.leaderboard_opt_in → false (ad artık listede görünmesin)
 *   auth.users.email          → yönlendirilemeyen yer tutucu adres
 *                               (GoTrue e-postayı benzersiz ister; boş
 *                               bırakılamadığı için silme yerine değiştirilir)
 *
 * ── NE KALIR ───────────────────────────────────────────────────────────────
 *   attempts, topic_mastery, mastery_history, daily_activity, xp_events,
 *   test_sessions, payments  →  satırlar OLDUĞU GİBİ kalır.
 *   Gerekçe: bu satırlar kişiyi tanımlayan alanları taşımaz; profil
 *   kimliğinden koptukları anda istatistiktirler. Silinmeleri platformun
 *   soru zorluk kalibrasyonunu ve muhasebe kayıtlarını bozardı — KVKK veri
 *   minimizasyonu bunu gerektirmez, saklama yükümlülüğü ise tam tersini
 *   söyler (ödeme kayıtları).
 *   profiles.role / grade / exam_id gibi alanlar da kalır: bir role sahip
 *   olmak kişiyi tanımlamaz.
 *
 * ── GERİ ALINAMAZ ──────────────────────────────────────────────────────────
 * Eski ad, görünen ad ve e-posta hiçbir yerde saklanmaz; işlem sonrası
 * geri getirilemez. Arayüz bunu yazılı onayla ister.
 *
 * Bu dosya saf: girdi aynıysa çıktı aynı, veritabanı tanımaz (CONVENTIONS §5).
 */

/** Anonimleştirilmiş kullanıcının her yerde göründüğü ad. */
export const ANONYMIZED_NAME = 'Silinmiş kullanıcı'

/**
 * `.invalid` üst düzey alan adı RFC 2606 ile kalıcı olarak ayrılmıştır; bu
 * adrese hiçbir zaman posta gitmez ve gerçek bir hesapla çakışamaz.
 */
export const ANONYMIZED_EMAIL_DOMAIN = 'anonim.invalid'

/** `profiles` üzerinde yazılacak alanlar. Burada olmayan hiçbir kolona dokunulmaz. */
export type AnonymizedProfileFields = {
  full_name: string
  display_name: string
  avatar_url: null
  invite_code: null
  leaderboard_opt_in: false
}

export function anonymizedProfileFields(): AnonymizedProfileFields {
  return {
    full_name: ANONYMIZED_NAME,
    display_name: ANONYMIZED_NAME,
    avatar_url: null,
    invite_code: null,
    leaderboard_opt_in: false,
  }
}

/**
 * Kullanıcı kimliğinden türetilen yer tutucu e-posta.
 * Kimliğin kendisi zaten kayıtlarda duruyor; adres yeni bir bilgi sızdırmaz
 * ama benzersiz olduğu için GoTrue'nun tekillik kısıtını karşılar.
 */
export function anonymizedEmail(userId: string): string {
  const normalized = userId.trim().toLowerCase()
  if (normalized.length === 0) {
    throw new Error('anonymizedEmail: kullanıcı kimliği boş olamaz.')
  }
  return `anonim+${normalized}@${ANONYMIZED_EMAIL_DOMAIN}`
}

/** Bir profilin daha önce anonimleştirilmiş olup olmadığı (tekrar tekrar çalıştırmayı önler). */
export function isAnonymizedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase().endsWith(`@${ANONYMIZED_EMAIL_DOMAIN}`)
}
