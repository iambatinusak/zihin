import { describe, expect, it } from 'vitest'
import { parseOptions } from './options'

describe('parseOptions', () => {
  it('geçerli şık dizisini okur', () => {
    expect(
      parseOptions([
        { key: 'A', text: 'Birinci' },
        { key: 'B', text: 'İkinci' },
      ]),
    ).toEqual([
      { key: 'A', text: 'Birinci' },
      { key: 'B', text: 'İkinci' },
    ])
  })

  it('dizi olmayan veriyi boş listeye çevirir', () => {
    expect(parseOptions(null)).toEqual([])
    expect(parseOptions(undefined)).toEqual([])
    expect(parseOptions({ A: 'Birinci' })).toEqual([])
    expect(parseOptions('A,B')).toEqual([])
  })

  it('anahtarı olmayan ya da bozuk elemanı düşürür', () => {
    expect(parseOptions([{ text: 'anahtarsız' }, null, 5, { key: 'B', text: 'İkinci' }])).toEqual([
      { key: 'B', text: 'İkinci' },
    ])
  })

  it('yinelenen anahtarda ilk elemanı korur', () => {
    expect(
      parseOptions([
        { key: 'A', text: 'ilk' },
        { key: 'A', text: 'ikinci' },
      ]),
    ).toEqual([{ key: 'A', text: 'ilk' }])
  })

  it('metni olmayan şıkkı boş metinle korur', () => {
    expect(parseOptions([{ key: 'C' }])).toEqual([{ key: 'C', text: '' }])
  })
})
