import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/page-header'
import { ParentOverview } from '@/components/parent/overview'
import { parentStrings } from '@/components/parent/strings'
import { requireRole } from '@/lib/auth'

/*
 * VELİ PANELİ — BİLİNÇLİ OLARAK SALT OKUNURDUR.
 *
 * Şartname §M12: "Veli hiçbir içeriği izleyemez/çözemez." Bu sayfa öğrenci
 * ekranlarının bir kopyası değildir: aynı bilgiyi gösterir ama hiçbir yerinde
 * içeriğe geçiş yoktur. Burada bilerek BULUNMAYANLAR:
 *
 *   · /video, /test, /kartlar, /sonuc bağlantıları
 *   · "Hızlı pratik" ya da StartTestButton benzeri başlatma düğmeleri
 *   · program bloğu tamamlama, plan üretme gibi hiçbir Server Action
 *
 * Öğrenci ekranında bağlantı olan her satır burada düz metindir. Bir sonraki
 * geliştirici "buraya bir kısayol koyalım" derse: koymayın, sınır budur.
 *
 * İkinci sınır kimliktedir: seçili öğrenci `?ogrenci=` parametresinden DEĞİL,
 * velinin `parent_links` kümesinden belirlenir (lib/parent/select.ts). Adres
 * çubuğuna yazılan yabancı bir kimlik sessizce ilk bağlı öğrenciye düşer;
 * veritabanı tarafında da RLS `can_read_student_data()` ile aynı sınırı ikinci
 * kez uygular (CONVENTIONS §3).
 */

export const metadata: Metadata = { title: 'Veli Paneli' }

/** Öğrencinin verisi her istekte tazedir; sayfa önbelleğe alınmaz. */
export const dynamic = 'force-dynamic'

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ogrenci?: string }>
}) {
  const user = await requireRole('parent')
  const params = await searchParams
  const s = parentStrings()

  return (
    <div className="space-y-6">
      <PageHeader title={s.title} description={s.description} />
      <ParentOverview parentId={user.id} basePath="/veli" studentParam={params.ogrenci} />
    </div>
  )
}
