import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { APP_NAME, APP_URL, BRAND_HUE } from '@/lib/env'
import { t } from '@/lib/i18n'
import 'katex/dist/katex.min.css'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — ${t('common.appTagline')}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Video ders, akıllı test, hafıza teknikleri ve kişiye özel çalışma programıyla LGS, YKS, KPSS, DGS ve ALES hazırlığı.',
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: APP_NAME,
    title: `${APP_NAME} — ${t('common.appTagline')}`,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1220' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={inter.variable}
      style={{ '--brand-hue': String(BRAND_HUE) } as React.CSSProperties}
    >
      <body className="bg-background min-h-dvh font-sans antialiased">
        <a
          href="#icerik"
          className="sr-only-focusable bg-primary text-primary-foreground absolute left-4 top-4 z-50 rounded-md px-4 py-2"
        >
          Ana içeriğe atla
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
