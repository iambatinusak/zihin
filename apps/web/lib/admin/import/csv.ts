import Papa from 'papaparse'

/**
 * Ham dosya metnini satır sözlüklerine çevirir — SAF (dosya sistemi, ağ, ortam yok).
 *
 * TÜRKİYE GERÇEĞİ: Excel'in "CSV UTF-8" çıktısı Türkçe Windows'ta NOKTALI
 * VİRGÜLLE ayrılır (liste ayırıcısı ondalık virgülle çakışmasın diye) ve dosyanın
 * başına BOM koyar. Bunları ele almazsak Türkiye'de Excel'den çıkan HER dosya
 * "sütunlar eksik" diye reddedilirdi. Bu yüzden:
 *   1. BOM atılır,
 *   2. ayırıcı ilk satırdan (tırnak dışı sayımla) tespit edilir,
 *   3. başlıklar küçük harfe indirilip boşluk/tire alt çizgiye çevrilir.
 */

export type RawRow = Record<string, unknown>

/**
 * Kaynak satır ve 1 TABANLI satır numarası.
 *
 * Numara kullanıcının Excel'de gördüğü satırdır: başlık 1, ilk veri satırı 2.
 * SINIR: tırnak içinde satır sonu taşıyan bir alan varsa dosyadaki fiziksel
 * satır numarası kayar; mantıksal (Excel'deki) numara doğru kalır ve rapor için
 * anlamlı olan odur.
 */
export type SourceRow = { line: number; data: RawRow }

export type ReadResult = {
  rows: SourceRow[]
  /** Dosyada bulunan (normalleştirilmiş) sütun adları. */
  columns: string[]
  /** Başlığın bulunduğu satır; JSON'da başlık yoktur (null). */
  headerLine: number | null
}

/** Ayırıcı adayları; tespit sayıma bakar, sıraya değil. */
export const DELIMITERS = [';', ',', '\t'] as const
export type Delimiter = (typeof DELIMITERS)[number]

const BOM = '﻿'

/** Baştaki UTF-8 BOM'unu atar. */
export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(BOM.length) : text
}

/**
 * Ayırıcıyı ilk dolu satıra bakarak seçer.
 *
 * Sayım TIRNAK DIŞINDA yapılır: `"Ali, Veli";"x"` satırında virgül şampiyon
 * görünürdü, oysa gerçek ayırıcı noktalı virgül. Hiç ayırıcı bulunamazsa virgül
 * döner (tek sütunlu dosya da geçerli bir CSV'dir).
 */
export function detectDelimiter(text: string): Delimiter {
  const line = firstNonEmptyLine(stripBom(text))
  if (line === null) return ','

  const counts: Record<Delimiter, number> = { ';': 0, ',': 0, '\t': 0 }
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      // Kaçış olarak yazılan `""` tırnak durumunu değiştirmez.
      if (inQuotes && line[index + 1] === '"') {
        index += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (inQuotes) continue
    if (char === ';' || char === ',' || char === '\t') counts[char] += 1
  }

  let best: Delimiter = ','
  let bestCount = 0
  for (const candidate of DELIMITERS) {
    const count = counts[candidate]
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return bestCount === 0 ? ',' : best
}

function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() !== '') return line
  }
  return null
}

/**
 * Başlık adını kanonik biçime getirir: BOM'suz, kırpılmış, küçük harfli,
 * boşluk ve tireler alt çizgi. `Option A` ile `option_a` aynı sütundur.
 *
 * Sütun adları İngilizce (CONVENTIONS §1) ve ASCII olduğu için `toLowerCase()`
 * burada Türkçe `I/ı` tuzağına düşmez.
 */
export function normalizeHeader(name: string): string {
  return stripBom(name)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

/** papaparse'ın fazla sütunları koyduğu teknik anahtar; veri değildir. */
const EXTRA_FIELD = '__parsed_extra'

/**
 * CSV metnini okur. Ayrıştırıcı hatası fırlatmaz; biçimsel bozukluklar satır
 * doğrulamasına (parse.ts) bırakılır — orada satır numarasıyla raporlanır.
 *
 * `skipEmptyLines` KAPALI tutulur: papaparse boş satırları atsaydı dizideki
 * sıra ile dosyadaki satır numarası ayrışırdı ve rapor yanlış satırı gösterirdi.
 * Boş satırlar okuduktan sonra, numaraları korunarak elenir.
 */
export function readCsv(text: string): ReadResult {
  const clean = stripBom(text)
  const parsed = Papa.parse<Record<string, unknown>>(clean, {
    header: true,
    delimiter: detectDelimiter(clean),
    skipEmptyLines: false,
    transformHeader: normalizeHeader,
  })

  const columns = (parsed.meta.fields ?? []).filter(
    (field) => field !== '' && field !== EXTRA_FIELD,
  )

  const rows: SourceRow[] = []
  ;(parsed.data ?? []).forEach((data, index) => {
    if (!data || typeof data !== 'object') return
    if (isEmptyRow(data)) return
    rows.push({ line: index + 2, data })
  })

  return { rows, columns, headerLine: 1 }
}

/**
 * JSON dizisini okur. Dizi değilse ya da elemanları nesne değilse hata fırlatır.
 * JSON'da "satır" dizideki sıradır (1 tabanlı); başlık satırı yoktur.
 */
export function readJson(text: string): ReadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripBom(text))
  } catch {
    throw new ImportFormatError('Dosya geçerli bir JSON değil.')
  }

  if (!Array.isArray(parsed)) {
    throw new ImportFormatError('JSON dosyası bir soru dizisi (`[ … ]`) olmalıdır.')
  }

  const rows: SourceRow[] = []
  const columns = new Set<string>()

  parsed.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ImportFormatError(
        `JSON dizisindeki ${index + 1}. eleman bir nesne değil; her soru bir nesne olmalıdır.`,
      )
    }
    const data: RawRow = {}
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      const column = normalizeHeader(key)
      data[column] = value
      columns.add(column)
    }
    if (!isEmptyRow(data)) rows.push({ line: index + 1, data })
  })

  return { rows, columns: [...columns], headerLine: null }
}

/** Dosya adına göre doğru okuyucuyu seçer. */
export function readImportFile(text: string, fileName: string): ReadResult {
  return fileName.trim().toLowerCase().endsWith('.json') ? readJson(text) : readCsv(text)
}

/** Dosya hiç okunamadığında fırlatılır; mesajı doğrudan kullanıcıya gösterilir. */
export class ImportFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportFormatError'
  }
}

function isEmptyRow(row: RawRow): boolean {
  return !Object.entries(row).some(
    ([key, value]) => key !== EXTRA_FIELD && String(value ?? '').trim() !== '',
  )
}
