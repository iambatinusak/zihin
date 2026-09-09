import { describe, expect, it } from 'vitest'
import { readImportFile } from './csv'
import { parseImportRows, type ParseResult } from './parse'

/**
 * TÜRK EXCEL'İ — gerçek dosya, uçtan uca.
 *
 * `csv.test.ts` ayırıcı tespitini, `parse.test.ts` kuralları tek tek
 * doğruluyor. Burada ikisi BİRLİKTE, editörün gerçekten yükleyeceği dosyayla
 * sınanır: Türkçe Windows'ta "CSV UTF-8 (virgülle ayrılmış)" seçeneği
 *
 *   - dosyanın başına BOM koyar,
 *   - alanları NOKTALI VİRGÜLLE ayırır (liste ayırıcısı, ondalık virgülle
 *     çakışmasın diye),
 *   - satırları CRLF ile bitirir,
 *   - içinde ayırıcı geçen alanları tırnaklar.
 *
 * Bu dördü aynı anda ele alınmazsa Türkiye'de Excel'den çıkan HER dosya
 * "zorunlu sütun eksik" diye reddedilir. Bu testin varlık sebebi o sessiz
 * reddin geri gelmemesidir.
 */

/** UTF-8 BOM (U+FEFF) ve Windows satır sonu — kaynakta kaçış dizisi kullanmadan. */
const BOM = String.fromCharCode(0xfeff)
const CRLF = String.fromCharCode(13, 10)

const TOPICS = { 'ucgende-acilar': 'topic-1', turev: 'topic-2' }

/** Excel'in yazdığı biçimde bir dosya kurar. */
function excelFile(rows: string[][]): string {
  const header = [
    'Stem',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Option E',
    'Correct',
    'Explanation',
    'Topic Slug',
    'Difficulty',
    'Expected Seconds',
  ]
  const quote = (cell: string) => (/[";]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)
  const line = (cells: string[]) => cells.map(quote).join(';')
  return BOM + [header, ...rows].map(line).join(CRLF) + CRLF
}

function read(text: string): ParseResult {
  const result = readImportFile(text, 'sorular.csv')
  return parseImportRows({
    rows: result.rows,
    columns: result.columns,
    topics: TOPICS,
    headerLine: result.headerLine,
  })
}

const OK_ROW = [
  'Bir üçgenin iç açıları toplamı kaçtır?',
  '90',
  '180',
  '270',
  '360',
  '',
  'B',
  'İç açılar toplamı 180 derecedir.',
  'ucgende-acilar',
  '2',
  '45',
]

describe('Excel çıktısı (BOM + noktalı virgül + CRLF)', () => {
  it('başlıkları tanır ve satırı içeri alır', () => {
    const result = read(excelFile([OK_ROW]))

    expect(result.errors).toEqual([])
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]?.stem).toBe('Bir üçgenin iç açıları toplamı kaçtır?')
    expect(result.valid[0]?.correctOption).toBe('B')
    expect(result.valid[0]?.topicId).toBe('topic-1')
    // Başlık 1. satır ⇒ ilk veri satırı 2.
    expect(result.valid[0]?.line).toBe(2)
  })

  it('tırnaklı alanın içindeki noktalı virgül veri sayılır, ayırıcı değil', () => {
    const row = [...OK_ROW]
    row[0] = 'Şunlardan hangisi doğrudur; neden?'
    row[7] = 'Kural: "toplam; her zaman 180"'

    const result = read(excelFile([row]))

    expect(result.errors).toEqual([])
    expect(result.valid[0]?.stem).toBe('Şunlardan hangisi doğrudur; neden?')
    expect(result.valid[0]?.explanation).toBe('Kural: "toplam; her zaman 180"')
  })

  it('BOM ilk başlığı bozmaz (stem sütunu kaybolmaz)', () => {
    const withoutBom = excelFile([OK_ROW]).slice(1)

    expect(read(excelFile([OK_ROW])).valid).toHaveLength(1)
    expect(read(withoutBom).valid).toHaveLength(1)
  })

  it('hataları 1 TABANLI Excel satır numarasıyla raporlar', () => {
    const badTopic = [...OK_ROW]
    badTopic[8] = 'olmayan-konu'
    const badCorrect = [...OK_ROW]
    badCorrect[6] = 'E' // option_e sütunu boş

    const result = read(
      excelFile([OK_ROW, badTopic, OK_ROW.map((c, i) => (i === 0 ? 'Başka soru' : c)), badCorrect]),
    )

    // Excel'de: 1 başlık, 2-5 veri. 2 ve 4 sağlam, 3 ve 5 hatalı.
    expect(result.valid.map((row) => row.line)).toEqual([2, 4])
    // Bir satırda birden çok sorun olabilir; sayım satır bazında yapılır.
    expect([...new Set(result.errors.map((error) => error.line))].sort()).toEqual([3, 5])
    expect(result.errors.find((error) => error.line === 3)?.message).toContain('olmayan-konu')
    expect(result.errors.find((error) => error.line === 5)?.column).toBe('correct')
  })

  it('doğru şık boş bir sütunu gösteriyorsa satır veritabanına HİÇ gitmez', () => {
    const row = [...OK_ROW]
    row[6] = 'E'

    const result = read(excelFile([row]))

    expect(result.valid).toEqual([])
    expect(result.errors[0]?.message).toContain('option_e')
  })

  it('boş satır sayıyı kaydırmaz', () => {
    const file = excelFile([OK_ROW]) + CRLF + [';;;;;;;;;;'].join('') + CRLF + excelFileDataOnly()

    const result = read(file)
    expect(result.valid.map((row) => row.line)).toEqual([2, 5])
  })
})

/** Başlıksız tek veri satırı — yukarıdaki dosyanın sonuna eklenir. */
function excelFileDataOnly(): string {
  const row = [...OK_ROW]
  row[0] = 'İkinci soru'
  return row.map((cell) => (/[";]/.test(cell) ? `"${cell}"` : cell)).join(';') + CRLF
}
