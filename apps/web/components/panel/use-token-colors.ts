'use client'

import * as React from 'react'

/**
 * Tasarım belirteçlerini grafiklerin okuyabileceği renge çevirir.
 *
 * Neden hook: Recharts rengi SVG ÖZNİTELİĞİ olarak yazar (`stroke="..."`) ve
 * öznitelikte `var(--token)` çözülmez — sabit renk yazmak da yasak
 * (CONVENTIONS §8). Bu yüzden belirtecin hesaplanmış değeri tarayıcıda
 * okunur. `.dark` sınıfı kök öğede değiştiğinde (next-themes) yeniden okunur,
 * böylece grafik koyu temada da doğru renkte kalır.
 *
 * `tokens` referans olarak sabit olmalıdır (modül düzeyinde bir dizi);
 * her render'da yeni dizi verilirse etki sonsuz döner.
 */
export function useTokenColors<T extends string>(tokens: readonly T[]): Record<T, string> {
  const [colors, setColors] = React.useState<Record<T, string>>(() => fallback(tokens))

  React.useEffect(() => {
    const root = document.documentElement

    const read = () => {
      const style = window.getComputedStyle(root)
      const next = {} as Record<T, string>
      for (const token of tokens) {
        const raw = style.getPropertyValue(`--${token}`).trim()
        // Belirteçler `H S% L%` üçlüsü olarak tanımlı (styles.css).
        next[token] = raw ? `hsl(${raw})` : 'currentColor'
      }
      setColors(next)
    }

    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => observer.disconnect()
  }, [tokens])

  return colors
}

/**
 * Sunucuda ve ilk boyamada kullanılan güvenli değer: `currentColor` metin
 * rengini alır, yani grafik hiçbir koşulda görünmez olmaz.
 */
function fallback<T extends string>(tokens: readonly T[]): Record<T, string> {
  const out = {} as Record<T, string>
  for (const token of tokens) out[token] = 'currentColor'
  return out
}
