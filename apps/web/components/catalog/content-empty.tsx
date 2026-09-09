import { EmptyState } from '@/components/common/empty-state'
import { section } from '@/lib/i18n'
import type { CatalogStrings } from './strings'

/**
 * "Bu konunun içeriği hazırlanıyor." Şu an 1164 konudan yalnızca üçünde içerik
 * var; bu yüzden boş durum istisna değil, sekmelerin olağan hâli. Boş alan ya da
 * hata ekranı yerine her sekmede bu kutu görünür.
 */
export function ContentEmpty({ description }: { description: string }) {
  const s = section<CatalogStrings>('catalog')
  return <EmptyState title={s.emptyContentTitle} description={description} className="py-10" />
}
