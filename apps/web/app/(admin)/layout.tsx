import { AppHeader } from '@/components/shell/app-header'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { requireRole } from '@/lib/auth'
import { getUnreadCount } from '@/lib/data'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { displayNameOf } from '@/lib/display-name'

/** Yönetim düzeni: üst çubuk + yönetim kenar çubuğu. Editör ve yönetici paylaşır. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['editor', 'admin'])
  const supabase = await createSupabaseServerClient()
  const unreadCount = await getUnreadCount(supabase, user.id)

  return (
    <div className="min-h-dvh">
      <AppHeader
        role={user.role}
        name={displayNameOf(user)}
        avatarUrl={user.avatarUrl}
        unreadCount={unreadCount}
      />

      <div className="flex">
        <aside className="border-border bg-background sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 border-r md:block">
          <AppSidebar role={user.role} />
        </aside>

        <main id="icerik" className="min-w-0 flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
