#!/usr/bin/env node
/**
 * `node scripts/generate-icons.mjs` — PWA ikonlarını üretir.
 *
 * Neden elle çizim: manifest üç PNG istiyor ve deposunda ikili dosya
 * tutmak yerine onları koddan üretmeyi tercih ettik. Marka rengi
 * (`NEXT_PUBLIC_BRAND_HUE`) değişince ikonlar tek komutla yeniden üretilir;
 * bir tasarım aracına ya da ek bağımlılığa gerek kalmaz.
 *
 * PNG doğrudan yazılıyor (imza + IHDR + IDAT + IEND). Tek dış yardım
 * `node:zlib`; raster kütüphanesi yok.
 *
 * Kullanım:
 *   node scripts/generate-icons.mjs
 *   node scripts/generate-icons.mjs --hue 200
 */
import { deflateSync, crc32 as zlibCrc32 } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'apps', 'web', 'public', 'icons')

const args = process.argv.slice(2)
const hueIndex = args.indexOf('--hue')
const HUE = hueIndex >= 0 ? Number(args[hueIndex + 1]) : 243

if (!Number.isFinite(HUE) || HUE < 0 || HUE > 360) {
  console.error('--hue 0-360 arasında olmalı.')
  process.exit(1)
}

// --- PNG yazımı ------------------------------------------------------------

/** zlib.crc32 Node 20.15+ ile geldi; yoksa tablo tabanlı yedek. */
const crc32 =
  typeof zlibCrc32 === 'function'
    ? (buf) => zlibCrc32(buf)
    : (() => {
        const table = new Uint32Array(256)
        for (let n = 0; n < 256; n++) {
          let c = n
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
          table[n] = c >>> 0
        }
        return (buf) => {
          let c = 0xffffffff
          for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8)
          return (c ^ 0xffffffff) >>> 0
        }
      })()

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/** RGBA piksel tamponunu PNG'ye çevirir. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit derinliği
  ihdr[9] = 6 // renk tipi: RGBA
  ihdr[10] = 0 // sıkıştırma
  ihdr[11] = 0 // filtre
  ihdr[12] = 0 // interlace yok

  // Her satır bir filtre baytıyla başlar (0 = None).
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- renk ------------------------------------------------------------------

/** HSL → RGB (0-255). Tasarım belirteçleriyle aynı ton kullanılsın diye. */
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

// styles.css'teki --primary ile aynı: hue 75% doygunluk, %52 açıklık.
const [BR, BG, BB] = hslToRgb(HUE, 0.75, 0.52)

// --- geometri --------------------------------------------------------------

/** Bir noktanın doğru parçasına uzaklığı — kalın çizgi çizmek için. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * "Z" harfi: üst çubuk, çapraz, alt çubuk. Normalize edilmiş (0-1) kutuda
 * tanımlı, böylece her boyutta aynı oranlarda çizilir.
 */
function zGlyphCoverage(nx, ny, stroke) {
  const half = stroke / 2
  const top = 0.3
  const bottom = 0.7
  const left = 0.27
  const right = 0.73

  const d = Math.min(
    distanceToSegment(nx, ny, left, top, right, top), // üst çubuk
    distanceToSegment(nx, ny, right, top, left, bottom), // çapraz
    distanceToSegment(nx, ny, left, bottom, right, bottom), // alt çubuk
  )

  // Kenar yumuşatma: yarıçapın etrafında bir pikselik geçiş.
  return Math.max(0, Math.min(1, (half - d) / 0.006 + 0.5))
}

/** Yuvarlatılmış kare — köşe yarıçapı kenarın oranı olarak. */
function roundedSquareCoverage(nx, ny, radius, inset) {
  const min = inset
  const max = 1 - inset
  if (nx < min || nx > max || ny < min || ny > max) return 0

  const cx = Math.min(Math.max(nx, min + radius), max - radius)
  const cy = Math.min(Math.max(ny, min + radius), max - radius)
  const d = Math.hypot(nx - cx, ny - cy)
  return Math.max(0, Math.min(1, (radius - d) / 0.004 + 0.5))
}

/**
 * Tek bir ikon üretir.
 * `maskable` true ise içerik %80'lik güvenli alana çekilir — Android ikonu
 * daire/kare maskeyle kırptığında harf kesilmesin (W3C maskable spec).
 */
function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4)

  // Maskeli sürümde arka plan kenarlara kadar dolar, glyph küçülür.
  const inset = maskable ? 0 : 0.04
  const radius = maskable ? 0 : 0.22
  const glyphScale = maskable ? 0.72 : 1
  const stroke = 0.105 * glyphScale

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Piksel merkezinden örnekle.
      const nx = (x + 0.5) / size
      const ny = (y + 0.5) / size

      const bg = maskable ? 1 : roundedSquareCoverage(nx, ny, radius, inset)

      // Glyph'i merkeze göre ölçekle.
      const gx = 0.5 + (nx - 0.5) / glyphScale
      const gy = 0.5 + (ny - 0.5) / glyphScale
      const glyph = gx < 0 || gx > 1 || gy < 0 || gy > 1 ? 0 : zGlyphCoverage(gx, gy, stroke)

      // Beyaz harfi marka rengiyle harmanla.
      const r = Math.round(BR + (255 - BR) * glyph)
      const g = Math.round(BG + (255 - BG) * glyph)
      const b = Math.round(BB + (255 - BB) * glyph)

      const i = (y * size + x) * 4
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = Math.round(bg * 255)
    }
  }

  return encodePng(size, size, rgba)
}

// --- yaz -------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })

const icons = [
  { file: 'icon-192.png', size: 192, opts: {} },
  { file: 'icon-512.png', size: 512, opts: {} },
  { file: 'icon-maskable-512.png', size: 512, opts: { maskable: true } },
  { file: 'apple-touch-icon.png', size: 180, opts: {} },
]

for (const { file, size, opts } of icons) {
  const png = renderIcon(size, opts)
  writeFileSync(join(OUT_DIR, file), png)
  console.log(`✓ icons/${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`)
}

console.log(`\nMarka tonu: ${HUE}° → rgb(${BR}, ${BG}, ${BB})`)
console.log('Ton değişirse bu komutu yeniden çalıştırın.')
