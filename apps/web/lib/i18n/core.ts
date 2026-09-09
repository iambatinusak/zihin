/*
 * Sözlüğün motoru — hiçbir JSON dosyası TANIMAZ.
 *
 * Ayrımın sebebi ölçülmüş bir maliyettir: `lib/i18n.ts` yirmi dört bölüm
 * dosyasının tamamını statik olarak import eder (94 kB). Bir Client Component
 * oradan `t` çekince Türkçe sözlüğün TAMAMI tarayıcı paketine giriyordu —
 * öğrencinin indirdiği pakette admin, öğretmen ve veli metinleri de vardı.
 *
 * Bu dosya yalnızca birleştirme ve arama mantığını taşır; sözlüğü çağıran
 * modül kurar. Böylece `lib/i18n/auth.ts` gibi dar bir modül yalnızca
 * ihtiyacı olan bölümleri paketler, geri kalanı hiç indirilmez.
 *
 * `fill` burada durur: saf bir metin fonksiyonudur, hiçbir sözlüğe bağlı
 * değildir. Yalnızca `fill` kullanan bileşen buradan alır ve sıfır sözlük
 * indirir.
 */

export const LOCALES = ['tr'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'tr'

export type Section = Record<string, unknown>

/**
 * Bölümleri temel sözlüğün üstüne derinlemesine birleştirir.
 * Aynı anahtar iki yerde tanımlıysa SONRAKİ kazanır; böylece bir özellik
 * paylaşılan bir metni kendi bağlamı için özelleştirebilir.
 */
export function deepMerge(target: Section, source: Section): Section {
  const out: Section = { ...target }
  for (const [key, value] of Object.entries(source)) {
    const existing = out[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing as Section, value as Section)
    } else {
      out[key] = value
    }
  }
  return out
}

function lookup(dictionary: Section, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

export type Dictionary = {
  /** Noktalı anahtarla çeviri okur: t('auth.login') */
  t: (key: string, locale?: Locale) => string
  /** Bir alt ağacı bir kerede alır: section<{ login: string }>('auth') */
  section: <T = Record<string, unknown>>(key: string, locale?: Locale) => T
  /** Ham sözlük — yalnızca test ve hata ayıklama için. */
  getDictionary: (locale?: Locale) => Section
}

/**
 * Verilen bölümleri sırayla birleştirip `t` / `section` üretir.
 * Sıra `lib/i18n.ts` içindeki kanonik sırayla AYNI olmalıdır; aksi hâlde iki
 * bölümün aynı anahtarı tanımladığı yerde dar modül farklı metin döndürür.
 */
export function createDictionary(sections: readonly Section[]): Dictionary {
  const tr = sections.reduce<Section>((acc, part) => deepMerge(acc, part), {})
  const dictionaries: Record<Locale, Section> = { tr }

  function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
    const value = lookup(dictionaries[locale], key)
    if (typeof value === 'string') return value
    // Eksik çeviri sessizce yutulmaz; geliştirme sırasında fark edilir olsun.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[i18n] eksik çeviri anahtarı: ${key}`)
    }
    return key
  }

  function section<T = Record<string, unknown>>(key: string, locale: Locale = DEFAULT_LOCALE): T {
    return (lookup(dictionaries[locale], key) ?? {}) as T
  }

  return { t, section, getDictionary: (locale: Locale = DEFAULT_LOCALE) => dictionaries[locale] }
}

/**
 * `{ad}` biçimindeki yer tutucuları doldurur. Karşılığı olmayan yer tutucu
 * olduğu gibi bırakılır — eksik çeviri sessizce boşluğa dönüşmesin.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}
