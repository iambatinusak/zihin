import type { Metadata } from 'next'
import Link from 'next/link'
import { BrainCircuit } from 'lucide-react'
import { APP_NAME } from '@/lib/env'
import { section, t } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'KVKK aydınlatma ve açık rıza metni',
  robots: { index: true, follow: true },
}

type LegalStrings = {
  title: string
  updated: string
  intro: string
  sections: { heading: string; paragraphs?: string[]; items?: string[] }[]
  backToRegister: string
}

/**
 * Kayıt formundaki açık rıza onay kutusunun bağlantı hedefi.
 *
 * Bağlantı vardı ama sayfa yoktu; zorunlu bir onayın metnine 404 ile gitmek
 * hem KVKK açısından hem ürün açısından kabul edilemez. Metin uygulamanın
 * gerçekten topladığı alanlara göre yazılmıştır (bkz. `profiles` tablosu ve
 * `app/(auth)/schemas.ts`); jenerik bir şablon değildir.
 *
 * Rota grubu dışında durur: `/kvkk` herkese açıktır (bkz. middleware
 * PUBLIC_PATHS) ve oturum gerektirmez.
 */
export default function KvkkPage() {
  const s = section<LegalStrings>('legal')

  return (
    <div className="bg-muted/30 min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          aria-label={t('shell.brandHome')}
          className="mb-8 flex items-center gap-2 text-lg font-semibold"
        >
          <BrainCircuit aria-hidden="true" className="text-primary size-7" />
          <span>{APP_NAME}</span>
        </Link>

        <main id="icerik" className="bg-card border-border rounded-lg border p-6 sm:p-8">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">{s.title}</h1>
          <p className="text-muted-foreground mt-1 text-xs">{s.updated}</p>
          <p className="text-foreground mt-4 text-sm leading-7">{s.intro}</p>

          <div className="mt-8 space-y-8">
            {s.sections.map((block) => (
              <section key={block.heading} className="space-y-3">
                <h2 className="text-foreground text-base font-semibold">{block.heading}</h2>
                {block.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-foreground text-sm leading-7">
                    {paragraph}
                  </p>
                ))}
                {block.items ? (
                  <ul className="text-foreground list-disc space-y-1.5 pl-5 text-sm leading-7">
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <p className="mt-10 text-sm">
            <Link href="/register" className="text-primary underline underline-offset-4">
              {s.backToRegister}
            </Link>
          </p>
        </main>
      </div>
    </div>
  )
}
