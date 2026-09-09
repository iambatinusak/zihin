import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@zihin/core', '@zihin/ui', '@zihin/db'],

  /*
   * Docker imajı için kendine yeten çıktı (bkz. docker/Dockerfile.web).
   *
   * YALNIZCA `DOCKER_BUILD=1` iken açık. Sebebi Windows: standalone çıktı
   * pnpm'in symlink ağacını kopyalarken sembolik bağ kurar ve Windows bunu
   * yönetici / geliştirici kipi olmadan reddeder (EPERM). Koşulsuz bıraksaydık
   * geliştiricinin yerel `pnpm build` komutu, kimsenin ihtiyaç duymadığı bir
   * Docker ayrıntısı yüzünden kırılırdı. Dockerfile bu değişkeni set eder.
   *
   * `outputFileTracingRoot` olmadan Next.js izlemeyi apps/web ile sınırlar ve
   * pnpm workspace'indeki @zihin/* paketleri imaja girmez — konteyner ayağa
   * kalkar, ilk istekte "module not found" ile ölür.
   */
  ...(process.env.DOCKER_BUILD === '1'
    ? { output: 'standalone', outputFileTracingRoot: join(here, '..', '..') }
    : {}),
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.b-cdn.net' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
