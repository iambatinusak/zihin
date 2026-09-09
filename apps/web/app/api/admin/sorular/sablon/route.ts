import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { buildTemplateCsv, TEMPLATE_FILENAME } from '@/lib/admin/import/template'
import { CONTENT_ROLES } from '@/lib/roles'

/**
 * Örnek CSV şablonu — GERÇEK bir HTTP indirmesi.
 *
 * `<a download>` + blob yolu tercih edilmedi: bazı gömülü görüntüleyicilerde ve
 * sıkı içerik politikalarında sessizce engelleniyor ve editör hiçbir şey
 * olmadığını sanıyor. `Content-Disposition: attachment` her yerde çalışır.
 *
 * YETKİ: bu bir Route Handler, yani düzenin (layout) guard'ı GEÇERLİ DEĞİL.
 * Rol burada bağımsız denetlenir. Şablon gizli bir bilgi taşımıyor ama
 * yönetim uçlarının açık bırakılması alışkanlık hâline gelmemeli.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Bu işlem için giriş yapmalısınız.' }, { status: 401 })
  }
  if (!CONTENT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
  }

  return new NextResponse(buildTemplateCsv(), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${TEMPLATE_FILENAME}"`,
      'Cache-Control': 'no-store',
    },
  })
}
