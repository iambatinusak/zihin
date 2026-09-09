import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Options as SanitizeSchema } from 'rehype-sanitize'

/**
 * Depoda saklanan Markdown'ın tek render noktası (hafıza notu, soru kökü,
 * rozet açıklaması...). İçerik editörden gelir; yani güvenilmez kabul edilir ve
 * **her zaman** temizlenir.
 *
 * Eklenti sırası önemlidir: `rehypeSanitize` en sonda çalışır, böylece
 * `rehypeKatex`in ürettiği HTML de süzgeçten geçer.
 */

/** KaTeX'in ürettiği MathML etiketleri. Varsayılan şema hiçbirini tanımaz. */
const MATHML_TAGS = [
  'math',
  'semantics',
  'annotation',
  'annotation-xml',
  'mrow',
  'mi',
  'mn',
  'mo',
  'ms',
  'mtext',
  'mspace',
  'mfrac',
  'msqrt',
  'mroot',
  'mstyle',
  'merror',
  'mpadded',
  'mphantom',
  'menclose',
  'msub',
  'msup',
  'msubsup',
  'munder',
  'mover',
  'munderover',
  'mmultiscripts',
  'mprescripts',
  'none',
  'mtable',
  'mtr',
  'mtd',
  'maction',
]

const defaultAttributes = defaultSchema.attributes ?? {}
const globalAttributes = defaultAttributes['*'] ?? []

/**
 * Varsayılan (GitHub) şemasının üstüne KaTeX'in ihtiyaçları eklenir:
 *
 *  - `className` her etikette serbesttir. KaTeX bütün yerleşimini
 *    `katex`, `katex-html`, `mord`, `vlist`... sınıflarıyla kurar; sınıflar
 *    süzülürse formül düz metne döner. Sınıf adı kod çalıştırmaz, risksizdir.
 *  - `style` yalnızca KaTeX'in ölçü verdiği etiketlerde serbesttir
 *    (`span`, `mstyle`). Genel bir `style` izni, konumlandırmayla sayfanın
 *    üstüne bindirme yapılmasına izin verirdi; bu yüzden daraltıldı.
 *  - MathML etiketleri ve KaTeX'in kullandığı birkaç öznitelik eklenir.
 *
 * `script`, `iframe`, olay öznitelikleri (`onclick`...) ve `javascript:`
 * protokolü varsayılan şemada zaten yasak; bu izinler onları geri getirmez.
 */
const schema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...MATHML_TAGS],
  attributes: {
    ...defaultAttributes,
    '*': [...globalAttributes, 'className', 'ariaHidden', 'ariaLabel', 'role'],
    span: [...(defaultAttributes.span ?? []), 'className', 'style'],
    mstyle: ['className', 'style', 'displaystyle', 'scriptlevel', 'mathcolor', 'mathvariant'],
    math: ['className', 'xmlns', 'display'],
    annotation: ['className', 'encoding'],
    'annotation-xml': ['className', 'encoding'],
    mi: ['className', 'mathvariant'],
    mo: ['className', 'stretchy', 'fence', 'separator', 'lspace', 'rspace'],
    mn: ['className'],
    mtext: ['className'],
    mspace: ['className', 'width', 'height', 'depth'],
    mpadded: ['className', 'width', 'height', 'depth', 'lspace', 'voffset'],
    menclose: ['className', 'notation'],
    mtable: ['className', 'rowspacing', 'columnspacing', 'columnalign', 'rowalign'],
    mtd: ['className', 'columnalign', 'rowalign'],
    mtr: ['className', 'columnalign', 'rowalign'],
  },
}

const PLUGINS = {
  remark: [remarkGfm, remarkMath],
  rehype: [rehypeKatex, [rehypeSanitize, schema]],
} as const

type MarkdownProps = {
  /** Ham Markdown. Boş ya da yalnızca boşluksa hiçbir şey basılmaz. */
  content: string | null | undefined
  className?: string
}

/**
 * Tipografisi ayarlanmış, temizlenmiş Markdown bloğu.
 * Sunucu bileşenidir; istemciye ne react-markdown ne de şema gönderilir.
 */
export function Markdown({ content, className }: MarkdownProps) {
  if (!content || content.trim().length === 0) return null

  return (
    <div
      className={['zihin-markdown text-foreground text-sm leading-7', className]
        .filter(Boolean)
        .join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[...PLUGINS.remark]}
        // rehype-sanitize en sonda: KaTeX çıktısı da süzgeçten geçsin.
        rehypePlugins={[...PLUGINS.rehype] as never}
        components={{
          h1: ({ node, ...props }) => (
            <h2 className="text-foreground mb-2 mt-6 text-lg font-semibold" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h3 className="text-foreground mb-2 mt-6 text-base font-semibold" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h4 className="text-foreground mb-1 mt-4 text-sm font-semibold" {...props} />
          ),
          p: ({ node, ...props }) => <p className="mb-3" {...props} />,
          ul: ({ node, ...props }) => <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />,
          ol: ({ node, ...props }) => (
            <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-primary underline underline-offset-2"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-border text-muted-foreground my-3 border-l-2 pl-4 italic"
              {...props}
            />
          ),
          code: ({ node, ...props }) => (
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]" {...props} />
          ),
          pre: ({ node, ...props }) => (
            <pre className="bg-muted mb-3 overflow-x-auto rounded-md p-3 text-xs" {...props} />
          ),
          hr: ({ node, ...props }) => <hr className="border-border my-6" {...props} />,
          table: ({ node, ...props }) => (
            <div className="mb-3 overflow-x-auto">
              <table className="border-border w-full border-collapse border text-left" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border-border bg-muted/50 border px-2 py-1 font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => <td className="border-border border px-2 py-1" {...props} />,
          img: ({ node, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="my-3 h-auto max-w-full rounded-md" {...props} alt={props.alt ?? ''} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
