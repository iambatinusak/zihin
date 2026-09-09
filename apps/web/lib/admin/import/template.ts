import { IMPORT_COLUMNS } from './parse'

/**
 * İndirilebilir CSV şablonu — SAF.
 *
 * Şablon `IMPORT_COLUMNS`tan üretilir; doğrulayıcıya sütun eklendiğinde şablon
 * kendiliğinden güncellenir, ikisi ayrışmaz.
 *
 * BİÇİM KARARLARI (Türkiye'de Excel ile açılacak):
 *  - Ayırıcı NOKTALI VİRGÜL: Türkçe Windows'ta liste ayırıcısı budur; virgüllü
 *    dosya Excel'de tek sütuna yapışır. Okuyucu ayırıcıyı zaten tespit ettiği
 *    için geri yükleme yine sorunsuz olur.
 *  - Başa BOM konur: BOM'suz UTF-8 dosyayı Excel Windows-1254 sanar ve
 *    "Ş, ğ, İ" bozulur.
 *  - Satır sonu CRLF: RFC 4180 ve Excel'in beklentisi.
 */

export const TEMPLATE_DELIMITER = ';'
export const TEMPLATE_FILENAME = 'zihin-soru-sablonu.csv'
const BOM = '﻿'
const EOL = '\r\n'

/** Şablondaki tek örnek satır. LaTeX ve Markdown'ın çalıştığını da gösterir. */
const EXAMPLE_ROW: Record<(typeof IMPORT_COLUMNS)[number], string> = {
  stem: 'Bir üçgenin iç açıları toplamı kaç derecedir? $\\alpha + \\beta + \\gamma = ?$',
  option_a: '90',
  option_b: '180',
  option_c: '270',
  option_d: '360',
  option_e: '',
  correct: 'B',
  explanation: 'Düzlemde bir üçgenin iç açıları toplamı her zaman **180°** olur.',
  topic_slug: 'ucgende-acilar',
  difficulty: '2',
  expected_seconds: '45',
}

/** RFC 4180 alan kaçışı: tırnak, ayırıcı ya da satır sonu varsa tırnakla. */
export function escapeCsvField(value: string, delimiter: string = TEMPLATE_DELIMITER): string {
  const needsQuotes =
    value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}

/** Başlık + bir örnek satırdan oluşan şablonun tam metni. */
export function buildTemplateCsv(): string {
  const header = IMPORT_COLUMNS.map((column) => escapeCsvField(column)).join(TEMPLATE_DELIMITER)
  const example = IMPORT_COLUMNS.map((column) => escapeCsvField(EXAMPLE_ROW[column])).join(
    TEMPLATE_DELIMITER,
  )
  return `${BOM}${header}${EOL}${example}${EOL}`
}
