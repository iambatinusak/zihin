import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileStack,
  GraduationCap,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Layers,
  Library,
  MessageCircleQuestion,
  Settings,
  Trophy,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/lib/roles'

/**
 * Gezinme modeli veri olarak durur. Yeni bir sayfa eklemek tek satırlık bir
 * değişikliktir; bileşenlere dokunulmaz.
 */
export type NavItem = {
  /** i18n anahtarı — metin koda gömülmez. */
  labelKey: string
  href: string
  icon: LucideIcon
  /**
   * true ise bağlantı yalnızca yol birebir eşleştiğinde etkin sayılır.
   * Kök bağlantıların (ör. /dashboard) alt yolları yüzünden hep etkin
   * görünmesini engeller.
   */
  exact?: boolean
}

export type NavSection = {
  /** Başlıksız bölüm için null — üst bölüm genelde başlıksızdır. */
  titleKey: string | null
  items: NavItem[]
}

const STUDENT_NAV: NavSection[] = [
  {
    titleKey: null,
    items: [
      { labelKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
      { labelKey: 'nav.program', href: '/program', icon: CalendarDays },
      { labelKey: 'nav.lessons', href: '/dersler', icon: BookOpen },
      { labelKey: 'nav.panel', href: '/panel', icon: BrainCircuit },
      { labelKey: 'nav.cards', href: '/kartlar', icon: Layers },
      { labelKey: 'nav.mock', href: '/deneme', icon: ClipboardList },
      { labelKey: 'nav.ask', href: '/soru-sor', icon: MessageCircleQuestion },
      { labelKey: 'nav.badges', href: '/rozetler', icon: Trophy },
      { labelKey: 'nav.settings', href: '/ayarlar', icon: Settings },
    ],
  },
]

const PARENT_NAV: NavSection[] = [
  {
    titleKey: null,
    items: [
      { labelKey: 'nav.parent', href: '/veli', icon: LayoutDashboard, exact: true },
      { labelKey: 'nav.parentStudents', href: '/veli/ogrenciler', icon: Users },
      { labelKey: 'nav.parentReports', href: '/veli/raporlar', icon: FileStack },
      { labelKey: 'nav.settings', href: '/ayarlar', icon: Settings },
    ],
  },
]

const TEACHER_NAV: NavSection[] = [
  {
    titleKey: null,
    items: [
      { labelKey: 'nav.teacherQuestions', href: '/ogretmen/sorular', icon: Inbox },
      { labelKey: 'nav.teacherStudents', href: '/ogretmen/ogrenciler', icon: GraduationCap },
      { labelKey: 'nav.settings', href: '/ayarlar', icon: Settings },
    ],
  },
]

/**
 * İçerik üretim ekranları. Editör de yönetici de aynı sırayı görür: müfredat
 * ağacı, sonra o ağaca asılan içerik (video, soru, test, kart, deneme).
 *
 * Bu liste `(admin)` altında GERÇEKTEN VAR OLAN rotalardan oluşur. Menüde
 * karşılığı olmayan bir bağlantı bırakmak (bir zamanlar burada duran
 * `/admin/icerik` gibi) editöre 404 gösterir.
 */
const CONTENT_NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.adminDashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { labelKey: 'nav.adminCurriculum', href: '/admin/mufredat', icon: Library },
  { labelKey: 'nav.adminVideos', href: '/admin/videolar', icon: Video },
  { labelKey: 'nav.adminQuestions', href: '/admin/sorular', icon: HelpCircle },
  { labelKey: 'nav.adminTests', href: '/admin/testler', icon: FileStack },
  { labelKey: 'nav.adminCards', href: '/admin/kartlar', icon: Layers },
  { labelKey: 'nav.adminMock', href: '/admin/denemeler', icon: ClipboardList },
]

const ADMIN_NAV: NavSection[] = [
  { titleKey: null, items: CONTENT_NAV_ITEMS },
  {
    titleKey: 'nav.adminManagement',
    items: [
      { labelKey: 'nav.adminUsers', href: '/admin/kullanicilar', icon: Users },
      { labelKey: 'nav.adminSubscriptions', href: '/admin/abonelikler', icon: CreditCard },
    ],
  },
]

/**
 * Editörün menüsü: içeriğin tamamı, yönetim bölümü yok.
 *
 * `/admin/kullanicilar` ve `/admin/abonelikler` editöre kapalıdır
 * (`requireRole('admin')`), pano ise ciroyu ve cron durumunu yalnızca
 * yöneticiye basar. Erişemeyeceği bağlantıları menüde göstermek yanlış bir söz
 * verirdi. Bu bir KOLAYLIK; yetki denetimi menüde değil, sayfa ve
 * action'lardadır — editör bu bağlantıları elle yazsa da sonuç değişmez.
 */
const EDITOR_NAV: NavSection[] = [{ titleKey: null, items: CONTENT_NAV_ITEMS }]

/** Rol başına gezinme. */
export const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  student: STUDENT_NAV,
  parent: PARENT_NAV,
  teacher: TEACHER_NAV,
  editor: EDITOR_NAV,
  admin: ADMIN_NAV,
}

export function navForRole(role: Role): NavSection[] {
  return NAV_BY_ROLE[role]
}

/** Bir bağlantının geçerli yola göre etkin olup olmadığı. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
