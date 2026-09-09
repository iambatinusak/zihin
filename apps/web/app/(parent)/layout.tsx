import { AppHeader } from '@/components/shell/app-header'
import { AppSidebar } from '@/components/shell/app-sidebar'
import { requireRole } from '@/lib/auth'
import { getUnreadCount } from '@/lib/data'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { displayNameOf } from '@/lib/display-name'

/** Veli düzeni: üst çubuk + sadeleştirilmiş yatay gezinme. */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('parent')
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

      <div className="border-border bg-background border-b">
        <AppSidebar role={user.role} orientation="horizontal" className="mx-auto max-w-6xl" />
      </div>

      <main id="icerik" className="mx-auto max-w-6xl p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
