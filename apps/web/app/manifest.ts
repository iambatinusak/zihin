import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/lib/env'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Sınav Hazırlığı`,
    short_name: APP_NAME,
    description:
      'Video dersler, akıllı testler, hafıza teknikleri ve kişiye özel çalışma programıyla sınav hazırlığı.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    lang: 'tr',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
