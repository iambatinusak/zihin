/**
 * Kalıcı canlı bölge.
 *
 * NEDEN AYRI BİR BİLEŞEN: ekran okuyucular bir canlı bölgeyi ancak DOM'da
 * ÖNCEDEN varsa izler. Mesaj göründüğü anda `role="status"` taşıyan bir düğüm
 * eklemek — projede on ayrı yerde yapılan şey — sessizce hiçbir şey
 * duyurmamakla sonuçlanır. Bu bileşen boşken de basılır; yalnızca içeriği
 * değişir, o değişiklik duyurulur.
 *
 * Görsel karşılığı ayrı yazılır: bu bölge `sr-only`, yerleşimi etkilemez
 * (Tailwind `sr-only` mutlak konumlandırır).
 */
export function LiveRegion({
  message,
  /** `assertive` yalnızca kullanıcının işini kesen durumlar içindir. */
  politeness = 'polite',
}: {
  message: string | null | undefined
  politeness?: 'polite' | 'assertive'
}) {
  return (
    <p aria-live={politeness} role="status" className="sr-only">
      {message ?? ''}
    </p>
  )
}
