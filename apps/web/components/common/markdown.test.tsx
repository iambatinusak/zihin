import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Markdown } from './markdown'

/**
 * Temizleme (sanitize) ayarı bu bileşenin en kritik parçası: hafıza notu
 * editörden gelen, güvenilmez içeriktir. Bu testler iki şeyi birlikte tutar —
 * zararlı biçimlendirme atılıyor, KaTeX'in kendi çıktısı ise korunuyor.
 */

function html(content: string): string {
  const { container } = render(<Markdown content={content} />)
  return container.innerHTML
}

describe('Markdown — temizleme', () => {
  it('script etiketini atar', () => {
    expect(html('<script>window.zarar = 1</script>Merhaba')).not.toContain('<script')
  })

  it('olay özniteliklerini atar', () => {
    const output = html('<img src="x" onerror="window.zarar = 1" alt="deneme">')
    expect(output).not.toContain('onerror')
  })

  it('javascript: bağlantısını atar', () => {
    const output = html('[tıkla](javascript:alert(1))')
    expect(output).not.toContain('javascript:')
  })

  it('iframe gömmesini atar', () => {
    expect(html('<iframe src="https://ornek.test"></iframe>')).not.toContain('<iframe')
  })

  /**
   * `<img src=x onerror=alert(1)>` klasik depolanmış XSS yüküdür ve bu içerik
   * editörden gelir. İki savunma birlikte çalışır: `rehype-raw` HİÇ kurulmadığı
   * için ham HTML zaten ayrıştırılmaz, `rehype-sanitize` de artakalanı süzer.
   */
  it('tırnaksız olay öznitelikli img yükünü tamamen düşürür', () => {
    const output = html('<img src=x onerror=alert(1)>')
    expect(output).not.toContain('onerror')
    expect(output).not.toContain('alert(1)')
    expect(output).not.toContain('<img')
  })

  it('ham HTML etiketlerini hiç ayrıştırmaz (rehype-raw kurulu değil)', () => {
    const output = html('<div id="sizinti"><b>kalın</b></div>')
    expect(output).not.toContain('<div id')
    expect(output).not.toContain('<b>')
  })

  it('svg/onload ve style yüklerini atar', () => {
    const output = html('<svg onload="window.zarar = 1"></svg>')
    expect(output).not.toContain('<svg')
    expect(output).not.toContain('onload')
    expect(html('<style>body{display:none}</style>')).not.toContain('<style')
  })

  it('bağlantıda protokol kaçışını atar', () => {
    expect(html('[tıkla](JaVaScRiPt:alert(1))').toLowerCase()).not.toContain('javascript:')
    expect(html('[tıkla](data:text/html,<script>alert(1)</script>)')).not.toContain(
      'data:text/html',
    )
  })
})

describe('Markdown — içerik', () => {
  it('boş içerikte hiçbir şey basmaz', () => {
    expect(html('   ')).toBe('')
  })

  it('react-markdown iç düğümünü (node) DOM özniteliğine sızdırmaz', () => {
    expect(html('Merhaba')).not.toContain('node=')
  })

  it('GFM tablosunu render eder', () => {
    const output = html('| a | b |\n| - | - |\n| 1 | 2 |')
    expect(output).toContain('<table')
    expect(output).toContain('<td')
  })

  it('GFM üstü çizili metnini render eder', () => {
    expect(html('~~silinmiş~~')).toContain('<del')
  })
})

describe('Markdown — KaTeX', () => {
  it('satır içi formülü KaTeX olarak render eder ve sınıfları korur', () => {
    const output = html('Şu ifade: $x^2 + y^2 = z^2$')
    // Sınıf adları süzülürse formül düz metne döner; bu iddia tam olarak
    // "sanitize şeması KaTeX sınıflarına izin veriyor mu" sorusunu ölçer.
    expect(output).toContain('class="katex"')
    expect(output).toMatch(/class="[^"]*\bmord\b/)
  })

  it('blok formülü KaTeX olarak render eder', () => {
    const output = html('$$\n\\frac{a}{b}\n$$')
    expect(output).toContain('katex-display')
  })

  it('KaTeX MathML çıktısını korur', () => {
    const output = html('$a+b$')
    expect(output).toContain('<math')
    expect(output).toContain('<annotation')
  })

  it('KaTeX ölçü stillerini span üzerinde korur', () => {
    const output = html('$$\\sqrt{x}$$')
    expect(output).toMatch(/<span[^>]*style="/)
  })
})
