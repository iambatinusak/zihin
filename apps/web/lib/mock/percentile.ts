import { MIN_PERCENTILE_SAMPLE, calculatePercentile } from '@zihin/core'

/**
 * Yüzdelik dilimin SUNUM kararları (spec §15).
 *
 * Hesabın kendisi `@zihin/core`'daki `calculatePercentile` içindedir ve burada
 * TEKRARLANMAZ. Bu dosyanın işi üç soruya cevap vermek:
 *   1. Örnek yeterli mi (20 katılımcı)? Değilse "yeterli veri yok" denir.
 *   2. Kullanıcının kendi neti listeye girdi mi? Girmediyse eklenir — kendi
 *      netini içermeyen bir dağılımda dilim hesabı anlamsızdır.
 *   3. Dilim, "ilk %X" cümlesine nasıl çevrilir?
 *
 * Saf dosya: ne Supabase, ne React, ne `Date.now()`.
 */

export { MIN_PERCENTILE_SAMPLE }

export type PercentileView =
  | {
      status: 'ready'
      /** 0-100 arası dilim; büyük olan iyidir. */
      percentile: number
      /** "İlk %X" cümlesinin X'i: 100 - dilim. */
      topPercent: number
      sampleSize: number
    }
  | {
      status: 'insufficient'
      sampleSize: number
      required: number
    }

/** Bir bitmiş oturumun dilime giren neti. */
export type ParticipantNet = {
  sessionId: string
  /** Oturumun sahibi. Katılımcı başına tek net kuralı buna dayanır. */
  userId: string
  net: number
}

/**
 * Dilim hesabına girecek net listesi: KATILIMCI BAŞINA TEK NET.
 *
 * Neden kişi başına tek: deneme yeniden çözülebiliyor, yani bir öğrencinin aynı
 * denemede birden çok bitmiş oturumu olabilir. Oturumlar olduğu gibi listeye
 * dökülürse dağılım kişileri değil DENEMELERİ sıralar; çok çözen bir öğrenci
 * hem kendi kopyalarıyla yarışır hem de 20 kişilik eşiği tek başına doldurup
 * olmayan bir sıralamayı açtırabilir. İkisi de öğrenciye yanlış bilgi verir.
 *
 * Diğer katılımcılar EN İYİ netleriyle temsil edilir: bir sıralama, kişinin
 * ulaştığı en iyi sonucu karşılaştırır.
 *
 * Kullanıcının KENDİ oturumlarının hepsi listeden çıkarılır ve yerlerine
 * sunucunun bu istekte hesapladığı `own.net` konur. Sebep: ekran BU oturumun
 * sonucunu açıklıyor, ayrıca `test_sessions.summary` serbest bir jsonb —
 * kendi satırımızın neti bayat ya da eksik olabiliyorken elimizde taze ve
 * doğrulanmış bir değer var. Başkaları için böyle bir imkân yok.
 */
export function buildNetPopulation(
  participants: readonly ParticipantNet[],
  own: { sessionId: string; userId: string; net: number },
): number[] {
  const bestByUser = new Map<string, number>()

  for (const participant of participants) {
    // Kullanıcının kendi oturumlarının HEPSİ elenir — yalnızca bakılan oturum
    // değil. Aksi hâlde öğrencinin eski denemeleri "başka katılımcı" sayılırdı.
    if (participant.userId === own.userId) continue
    if (!Number.isFinite(participant.net)) continue

    const best = bestByUser.get(participant.userId)
    if (best === undefined || participant.net > best) {
      bestByUser.set(participant.userId, participant.net)
    }
  }

  const nets = [...bestByUser.values()]
  if (Number.isFinite(own.net)) nets.push(own.net)
  return nets
}

/** Yarımları sıfırdan uzağa yuvarlar; `-0` üretmez. */
function round1(value: number): number {
  const result = Math.round(Math.abs(value) * 10 + 1e-9) / 10
  const signed = value < 0 ? -result : result
  return signed === 0 ? 0 : signed
}

/**
 * Dilim görünümü. Örnek 20'nin ALTINDAYSA hesap yapılmaz ve arayüz
 * "yeterli veri yok" der — 5 kişilik bir dağılımda "ilk %20'desin" demek
 * öğrenciyi yanıltır.
 */
export function buildPercentileView(userNet: number, allNets: readonly number[]): PercentileView {
  const valid = allNets.filter((net) => Number.isFinite(net))
  const percentile = calculatePercentile(userNet, valid)

  if (percentile === null) {
    return { status: 'insufficient', sampleSize: valid.length, required: MIN_PERCENTILE_SAMPLE }
  }

  return {
    status: 'ready',
    percentile,
    // Dilim 100 ise "ilk %0" saçma olurdu; en küçük anlamlı değer 0.1'dir.
    topPercent: Math.max(0.1, round1(100 - percentile)),
    sampleSize: valid.length,
  }
}

/**
 * "İlk %X" değerinin okunur biçimi: 12.0 yerine 12, 0.5 yerine 0,5.
 * Türkçe'de ondalık ayırıcı virgüldür.
 */
export function formatTopPercent(value: number): string {
  const rounded = round1(value)
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded).replace('.', ',')
}
