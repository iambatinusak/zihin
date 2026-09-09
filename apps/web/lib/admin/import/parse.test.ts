import { describe, expect, it } from 'vitest'
import { readCsv, readJson } from './csv'
import { DEFAULT_DIFFICULTY, IMPORT_COLUMNS, parseImportRows, type RowError } from './parse'
import { buildTemplateCsv } from './template'

/**
 * `parse.ts` içeriği sessizce bozabilecek tek nokta: yanlış satırı işaret eden
 * bir hata ya da kaçırılan bir kural, editörün fark etmediği bozuk soruya
 * dönüşür. Bu yüzden her hata sınıfı ve SATIR NUMARASI tek tek çivilenir.
 */

const TOPICS = {
  'ucgende-acilar': 'topic-1',
  turev: 'topic-2',
}

/** Test kısalsın diye: başlık + verilen veri satırlarından CSV metni üretir. */
function csv(lines: string[], delimiter = ','): string {
  return [IMPORT_COLUMNS.join(delimiter), ...lines].join('\n')
}

function parse(text: string) {
  const read = readCsv(text)
  return parseImportRows({
    rows: read.rows,
    columns: read.columns,
    topics: TOPICS,
    headerLine: read.headerLine,
  })
}

function messagesFor(errors: RowError[], line: number): string[] {
  return errors.filter((error) => error.line === line).map((error) => error.message)
}

const GOOD = 'Soru kökü,A şıkkı,B şıkkı,C şıkkı,D şıkkı,,B,Açıklama,ucgende-acilar,2,45'

describe('parseImportRows — düzgün dosya', () => {
  it('beş sütunlu tam bir satırı içeri alır', () => {
    const result = parse(csv(['$x^2$ kaçtır?,1,2,3,4,5,C,Çünkü öyle,turev,4,90']))

    expect(result.errors).toEqual([])
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]).toEqual({
      line: 2,
      stem: '$x^2$ kaçtır?',
      options: [
        { key: 'A', text: '1' },
        { key: 'B', text: '2' },
        { key: 'C', text: '3' },
        { key: 'D', text: '4' },
        { key: 'E', text: '5' },
      ],
      correctOption: 'C',
      explanation: 'Çünkü öyle',
      topicSlug: 'turev',
      topicId: 'topic-2',
      difficulty: 4,
      expectedSeconds: 90,
    })
  })

  it('dört şıklı satır geçerlidir (4 de 5 de olur)', () => {
    const result = parse(csv([GOOD]))

    expect(result.errors).toEqual([])
    expect(result.valid[0]?.options).toHaveLength(4)
    expect(result.valid[0]?.correctOption).toBe('B')
  })

  it('boş difficulty ve expected_seconds varsayılana düşer', () => {
    const result = parse(csv(['Kök,1,2,3,4,,A,,turev,,']))

    expect(result.errors).toEqual([])
    expect(result.valid[0]?.difficulty).toBe(DEFAULT_DIFFICULTY)
    expect(result.valid[0]?.expectedSeconds).toBeNull()
    expect(result.valid[0]?.explanation).toBeNull()
  })

  it('şablonun kendisi hatasız ayrıştırılır', () => {
    const result = parseImportRows({
      ...readCsv(buildTemplateCsv()),
      topics: TOPICS,
    })

    expect(result.errors).toEqual([])
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]?.line).toBe(2)
  })
})

describe('parseImportRows — satır numaraları', () => {
  it('başlık 1. satırdır; veri 2. satırdan başlar', () => {
    const result = parse(csv([GOOD, GOOD.replace('Soru kökü', 'Başka soru')]))

    expect(result.valid.map((row) => row.line)).toEqual([2, 3])
  })

  it('araya giren boş satır numaraları kaydırmaz', () => {
    const result = parse(csv([GOOD, '', GOOD.replace('Soru kökü', 'Dördüncü satır')]))

    expect(result.errors).toEqual([])
    expect(result.valid.map((row) => row.line)).toEqual([2, 4])
  })

  it('hatalı satırın numarası dosyadaki yerini gösterir', () => {
    const result = parse(csv([GOOD, ',1,2,3,4,,A,,turev,,']))

    expect(result.valid.map((row) => row.line)).toEqual([2])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.line).toBe(3)
    expect(result.errors[0]?.column).toBe('stem')
  })
})

describe('parseImportRows — hata sınıfları', () => {
  it('eksik zorunlu sütun tek bir başlık hatası verir, satırları denemez', () => {
    const result = parse('stem,option_a,correct\nKök,1,A')

    expect(result.valid).toEqual([])
    expect(result.errors).toHaveLength(2)
    expect(result.errors.map((error) => error.column).sort()).toEqual(['option_b', 'topic_slug'])
    expect(result.errors.every((error) => error.line === 1)).toBe(true)
    expect(result.errors[0]?.message).toContain('Zorunlu sütun eksik')
  })

  it('boş soru kökü reddedilir', () => {
    const result = parse(csv([',1,2,3,4,,A,,turev,3,60']))

    expect(result.valid).toEqual([])
    expect(messagesFor(result.errors, 2)).toContain('Soru kökü boş olamaz.')
  })

  it('bilinmeyen topic_slug reddedilir ve slug mesajda geçer', () => {
    const result = parse(csv(['Kök,1,2,3,4,,A,,olmayan-konu,3,60']))

    expect(result.valid).toEqual([])
    expect(messagesFor(result.errors, 2)[0]).toContain('olmayan-konu')
    expect(result.errors[0]?.column).toBe('topic_slug')
  })

  it('boş topic_slug reddedilir', () => {
    const result = parse(csv(['Kök,1,2,3,4,,A,,,3,60']))

    expect(result.errors[0]?.column).toBe('topic_slug')
  })

  it('correct boş bir şıkkı gösteriyorsa reddedilir', () => {
    const result = parse(csv(['Kök,1,2,3,4,,E,,turev,3,60']))

    expect(result.valid).toEqual([])
    expect(messagesFor(result.errors, 2)[0]).toContain('option_e')
  })

  it('correct A-E dışındaysa reddedilir', () => {
    const result = parse(csv(['Kök,1,2,3,4,,Z,,turev,3,60']))

    expect(result.errors[0]?.column).toBe('correct')
    expect(result.errors[0]?.message).toContain('"Z"')
  })

  it('correct boşsa reddedilir', () => {
    const result = parse(csv(['Kök,1,2,3,4,,,,turev,3,60']))

    expect(messagesFor(result.errors, 2)).toContain('Doğru şık (correct) boş olamaz.')
  })

  it('correct farklı yazımları kabul edilir', () => {
    for (const written of ['b', 'B)', 'B.', 'option_b', ' b ']) {
      const result = parse(csv([`Kök,1,2,3,4,,${written},,turev,3,60`]))
      expect(result.errors, written).toEqual([])
      expect(result.valid[0]?.correctOption).toBe('B')
    }
  })

  it('zorluk 1-5 dışındaysa reddedilir', () => {
    for (const value of ['0', '6', '2.5', 'zor']) {
      const result = parse(csv([`Kök,1,2,3,4,,A,,turev,${value},60`]))
      expect(result.valid, value).toEqual([])
      expect(result.errors[0]?.column).toBe('difficulty')
    }
  })

  it('expected_seconds sayı değilse ya da pozitif değilse reddedilir', () => {
    for (const value of ['abc', '0', '-30']) {
      const result = parse(csv([`Kök,1,2,3,4,,A,,turev,3,${value}`]))
      expect(result.valid, value).toEqual([])
      expect(result.errors[0]?.column).toBe('expected_seconds')
    }
  })

  it('ondalık süre (Türkçe virgüllü yazım dâhil) reddedilir', () => {
    // CSV'de tırnaksız `12,5` iki hücreye bölünürdü; kural doğrudan denenir.
    const result = parseImportRows({
      rows: [
        {
          line: 7,
          data: {
            stem: 'Kök',
            option_a: '1',
            option_b: '2',
            correct: 'A',
            topic_slug: 'turev',
            expected_seconds: '12,5',
          },
        },
      ],
      columns: [...IMPORT_COLUMNS],
      topics: TOPICS,
    })

    expect(result.valid).toEqual([])
    expect(result.errors).toEqual([
      {
        line: 7,
        column: 'expected_seconds',
        message: 'Beklenen süre saniye cinsinden pozitif bir tam sayı olmalı; "12,5" okundu.',
      },
    ])
  })

  it('iki şıktan az olan satır reddedilir', () => {
    const result = parse(csv(['Kök,1,,,,,A,,turev,3,60']))

    expect(result.valid).toEqual([])
    expect(messagesFor(result.errors, 2)[0]).toContain('en az 2')
  })

  it('şıklar arasında boşluk bırakılamaz', () => {
    const result = parse(csv(['Kök,1,,3,,,A,,turev,3,60']))

    expect(result.valid).toEqual([])
    expect(result.errors[0]?.column).toBe('option_b')
    expect(result.errors[0]?.message).toContain('sırayla')
  })

  it('dosya içindeki kopya satır ilk satırı işaret ederek reddedilir', () => {
    const result = parse(csv([GOOD, GOOD]))

    expect(result.valid.map((row) => row.line)).toEqual([2])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.line).toBe(3)
    expect(result.errors[0]?.message).toContain('2. satır')
  })

  it('aynı kök farklı konudaysa kopya sayılmaz', () => {
    const result = parse(
      [IMPORT_COLUMNS.join(','), GOOD, GOOD.replace('ucgende-acilar', 'turev')].join('\n'),
    )

    expect(result.errors).toEqual([])
    expect(result.valid).toHaveLength(2)
  })

  it('tek satırdaki birden çok sorun aynı anda raporlanır', () => {
    const result = parse(csv([',1,2,3,4,,Z,,olmayan,9,x']))

    const columns = messagesFor(result.errors, 2).length
    expect(columns).toBeGreaterThanOrEqual(4)
    expect(result.errors.map((error) => error.column)).toEqual(
      expect.arrayContaining(['stem', 'correct', 'topic_slug', 'difficulty', 'expected_seconds']),
    )
  })
})

describe('Excel gerçekleri', () => {
  it('noktalı virgüllü ve BOM ile başlayan dosya okunur', () => {
    const text = `﻿${IMPORT_COLUMNS.join(';')}\r\n${GOOD.split(',').join(';')}\r\n`
    const result = parse(text)

    expect(result.errors).toEqual([])
    expect(result.valid[0]?.topicSlug).toBe('ucgende-acilar')
  })

  it('sekmeyle ayrılmış dosya okunur', () => {
    const result = parse(csv([GOOD.split(',').join('\t')], '\t'))

    expect(result.errors).toEqual([])
    expect(result.valid).toHaveLength(1)
  })

  it('büyük harfli ve boşluklu başlıklar aynı sütuna eşlenir', () => {
    const result = parse('Stem,Option A,Option B,Correct,Topic Slug\nKök,1,2,A,turev')

    expect(result.errors).toEqual([])
    expect(result.valid[0]?.options).toHaveLength(2)
  })

  it('tırnak içindeki virgül ayırıcı sanılmaz', () => {
    const text = `${IMPORT_COLUMNS.join(';')}\n"Ali, Veli ve Deli";1;2;3;4;;A;;turev;3;60`
    const result = parse(text)

    expect(result.errors).toEqual([])
    expect(result.valid[0]?.stem).toBe('Ali, Veli ve Deli')
  })
})

describe('JSON girdisi', () => {
  it('nesne dizisi okunur; satır numarası dizideki sıradır', () => {
    const read = readJson(
      JSON.stringify([
        { stem: 'Bir', option_a: '1', option_b: '2', correct: 'A', topic_slug: 'turev' },
        { stem: '', option_a: '1', option_b: '2', correct: 'A', topic_slug: 'turev' },
      ]),
    )
    const result = parseImportRows({ ...read, topics: TOPICS })

    expect(result.valid.map((row) => row.line)).toEqual([1])
    expect(result.errors[0]?.line).toBe(2)
  })

  it('dizi olmayan JSON hata fırlatır', () => {
    expect(() => readJson('{"stem":"x"}')).toThrow(/soru dizisi/)
  })

  it('bozuk JSON hata fırlatır', () => {
    expect(() => readJson('{')).toThrow(/geçerli bir JSON/)
  })
})
