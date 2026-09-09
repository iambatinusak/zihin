import { describe, expect, it } from 'vitest'
import { detectDelimiter, normalizeHeader, readCsv, readImportFile, stripBom } from './csv'

describe('stripBom', () => {
  it('yalnızca baştaki BOM atılır', () => {
    expect(stripBom('﻿stem')).toBe('stem')
    expect(stripBom('stem')).toBe('stem')
    expect(stripBom('a﻿b')).toBe('a﻿b')
  })
})

describe('detectDelimiter', () => {
  it('en çok geçen ayırıcıyı seçer', () => {
    expect(detectDelimiter('a;b;c')).toBe(';')
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
  })

  it('tırnak içindeki ayırıcıları saymaz', () => {
    expect(detectDelimiter('"a,b,c,d";"e";"f"')).toBe(';')
  })

  it('kaçışlı tırnak (\"\") sayımı bozmaz', () => {
    expect(detectDelimiter('"de""di, dedi";x;y')).toBe(';')
  })

  it('BOM ve boş satırlar atlanır', () => {
    expect(detectDelimiter('﻿\n\na;b;c')).toBe(';')
  })

  it('ayırıcı yoksa virgül döner', () => {
    expect(detectDelimiter('tekbasina')).toBe(',')
    expect(detectDelimiter('')).toBe(',')
  })
})

describe('normalizeHeader', () => {
  it('kırpar, küçültür, boşluk ve tireyi alt çizgiye çevirir', () => {
    expect(normalizeHeader('  Option A ')).toBe('option_a')
    expect(normalizeHeader('expected-seconds')).toBe('expected_seconds')
    expect(normalizeHeader('﻿stem')).toBe('stem')
  })
})

describe('readCsv', () => {
  it('boş satırları eler ama numaraları korur', () => {
    const result = readCsv('a,b\n1,2\n\n3,4\n')

    expect(result.headerLine).toBe(1)
    expect(result.rows.map((row) => row.line)).toEqual([2, 4])
    expect(result.rows[1]?.data).toMatchObject({ a: '3', b: '4' })
  })

  it('sütun listesini normalleştirilmiş verir', () => {
    expect(readCsv('Stem;Option A\nx;y').columns).toEqual(['stem', 'option_a'])
  })
})

describe('readImportFile', () => {
  it('uzantıya göre okuyucu seçer', () => {
    expect(readImportFile('[{"stem":"x"}]', 'sorular.JSON').rows[0]?.data).toMatchObject({
      stem: 'x',
    })
    expect(readImportFile('stem\nx', 'sorular.csv').rows[0]?.data).toMatchObject({ stem: 'x' })
  })
})
