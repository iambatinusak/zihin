/**
 * Soru şıklarının tek ayrıştırıcısı.
 *
 * Şıklar veritabanında `jsonb` olarak durur (`[{"key":"A","text":"..."}]`,
 * bkz. 0004_content.sql). Üretilen tip `Json`, yani okuma tarafında `unknown`;
 * daraltmanın yapıldığı tek yer burasıdır.
 *
 * NEDEN NÖTR BİR MODÜL: aynı ayrıştırma hem sunucuda (test motorunun okuma
 * katmanı, `lib/data/test.ts`) hem istemcide (video checkpoint kaplaması) lazım.
 * `lib/data/*` `server-only` taşıdığı için istemci oradan içe aktaramaz; iki
 * ayrı kopya ise iki ayrı davranış demekti. Bu dosya hiçbir çalışma ortamına
 * bağlı değildir, iki taraf da aynı kopyayı kullanır.
 *
 * ŞIKLAR ASLA KARIŞTIRILMAZ — yayımlanmış sıra anlam taşır ("A ve B",
 * "yukarıdakilerin hepsi" gibi şıklar sıraya bağlıdır). Bu fonksiyon girdideki
 * sırayı olduğu gibi korur.
 */

export type QuestionOption = {
  key: string
  text: string
}

function readString(source: Record<string, unknown>, field: string): string | null {
  const value = source[field]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * `unknown` şık verisini güvenli bir listeye çevirir.
 *
 * Biçimi bozuk eleman sessizce düşer: bozuk tek bir şık yüzünden soru hiç
 * gösterilememesindense eksik gösterilmesi yeğdir. Aynı anahtar iki kez
 * geçerse ilki kalır — yinelenen anahtar React'te çakışan `key` üretir ve
 * hangi şıkkın işaretlendiği belirsizleşirdi.
 *
 * Boş dizi dönerse çağıran taraf soruyu atlar.
 */
export function parseOptions(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const options: QuestionOption[] = []

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const key = readString(record, 'key')
    if (key === null || seen.has(key)) continue
    seen.add(key)
    options.push({ key, text: readString(record, 'text') ?? '' })
  }

  return options
}
