import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MarkdownPreview as QuestionPreview } from './questions/markdown-preview'
import { MarkdownPreview as MediaPreview } from './media/markdown-preview'

/**
 * ÖNİZLEME = ÖĞRENCİNİN GÖRDÜĞÜ BORU HATTI.
 *
 * Yönetim panelindeki iki canlı önizleme (soru düzenleyici ve kart
 * düzenleyici) `components/common/markdown`i `next/dynamic` ile yükler. Bu
 * testler o bağın KOPMADIĞINI kanıtlar: önizlemeye verilen depolanmış XSS
 * yükleri, öğrenci yüzeyinde olduğu gibi temizlenir.
 *
 * Neden `markdown.test.tsx` yetmiyor: orada bileşenin KENDİSİ doğrulanıyor.
 * Buradaki risk farklı — birinin önizlemeyi "hızlı olsun" diye ham bir
 * renderer'a (ör. `dangerouslySetInnerHTML`) bağlaması. Editör hesabı
 * sanıldığından düşük bir eşiktir; buradan kaçan yük HER ÖĞRENCİYE gider.
 *
 * DİKKAT: her iddiadan önce İŞARETÇİ metnin ekrana düştüğü beklenir. Aksi
 * hâlde `next/dynamic` daha çözülmemişken boş bir kutuya bakılır ve test
 * hiçbir şey kanıtlamadan geçerdi.
 */

const MARKER = 'ZIHIN-ISARET'

const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '<script>window.__xss = 1</script>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '[tıkla](javascript:alert(1))',
  '<svg onload=alert(1)></svg>',
  '<a href="JaVaScRiPt:alert(1)">bağlantı</a>',
]

async function previewHtml(node: React.ReactElement): Promise<string> {
  const { container } = render(node)
  // Cömert bir süre: `next/dynamic` ilk çağrıda react-markdown + KaTeX
  // paketini çözer; tüm takım birlikte koşarken bu 1 saniyeyi aşabiliyor.
  await waitFor(
    () => {
      expect(container.querySelector('.zihin-markdown')?.textContent ?? '').toContain(MARKER)
    },
    { timeout: 20_000 },
  )
  return container.innerHTML
}

function assertClean(html: string) {
  expect(html).toContain(MARKER)
  expect(html).not.toContain('<script')
  expect(html).not.toContain('onerror')
  expect(html).not.toContain('onload')
  expect(html).not.toContain('<iframe')
  expect(html.toLowerCase()).not.toContain('javascript:')
}

describe('Yönetim önizlemesi — temizleme', () => {
  for (const payload of PAYLOADS) {
    const content = `${payload}

${MARKER}`

    it(`soru önizlemesi yükü temizler: ${payload.slice(0, 30)}`, async () => {
      assertClean(await previewHtml(<QuestionPreview content={content} />))
    })

    it(`kart önizlemesi yükü temizler: ${payload.slice(0, 30)}`, async () => {
      assertClean(await previewHtml(<MediaPreview content={content} />))
    })
  }

  it('ham HTML etiketi biçimlendirmeye dönüşmez', async () => {
    const html = await previewHtml(
      <QuestionPreview
        content={`<b>kalın</b>

${MARKER}`}
      />,
    )
    expect(html).not.toContain('<b>')
  })
})
