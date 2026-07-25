import type { Role } from "@/types/tawd";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  Stethoscope,
  ClipboardList,
  CreditCard,
  Building2,
  Megaphone,
  Star,
  Scissors,
  Bot,
  Scale,
  Wallet,
  Workflow,
  Boxes,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
  /** Optional group heading. The sidebar prints it once above the first item
      that carries it; menus with no sections render flat as before. */
  section?: string;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  clinic_admin: [
    { label: "لوحة التحكم",  href: "/clinic-admin",              icon: LayoutDashboard, exact: true },

    { section: "العيادة اليوم",
      label: "المواعيد",     href: "/clinic-admin/appointments",  icon: Calendar },
    { label: "المرضى",       href: "/clinic-admin/patients",      icon: UserCircle },
    { label: "خطط العلاج",   href: "/clinic-admin/treatment-plans", icon: ClipboardList },

    /* Invoicing, expenses, payroll, commissions and the online gateway all
       answer "where is the clinic's money?" — one entry, tabs inside. */
    { section: "المال",
      label: "المالية",      href: "/clinic-admin/finance",        icon: Wallet },
    { label: "التأمين",      href: "/clinic-admin/insurance",      icon: ShieldCheck },

    { section: "الموارد",
      label: "الخدمات",      href: "/clinic-admin/services",      icon: Scissors },
    { label: "المخزون",      href: "/clinic-admin/inventory",     icon: Boxes },
    { label: "الكادر الطبي", href: "/clinic-admin/staff",         icon: Users },

    { section: "النمو",
      label: "التسويق",      href: "/clinic-admin/marketing",     icon: Megaphone },
    { label: "تحليلات سُرى",  href: "/clinic-admin/sura-analytics", icon: Bot },
    { label: "التقارير",     href: "/clinic-admin/reports",       icon: BarChart3 },

    { section: "النظام",
      label: "الإعدادات",   href: "/clinic-admin/settings",      icon: Settings },
  ],
  doctor: [
    { label: "جدولي اليوم",    href: "/doctor",              icon: Stethoscope, exact: true },
    { label: "مواعيدي",        href: "/doctor/appointments",  icon: Calendar },
    { label: "مرضاي",          href: "/doctor/patients",      icon: UserCircle },
    { label: "خطط علاجي",      href: "/doctor/treatment-plans", icon: ClipboardList },
    { label: "دوامي وإجازاتي", href: "/doctor/schedule",      icon: ClipboardList },
    { label: "إحصائياتي",      href: "/doctor/stats",         icon: BarChart3 },
    { label: "إعداداتي",       href: "/doctor/settings",      icon: Settings },
  ],
  receptionist: [
    { label: "لوحة الاستقبال", href: "/reception",       icon: ClipboardList, exact: true },
    { label: "حجز موعد",       href: "/reception/book",  icon: Calendar },
  ],
  accountant: [
    { label: "لوحة المالية",  href: "/accountant",           icon: CreditCard, exact: true },
    { label: "الفواتير",      href: "/accountant/invoices",  icon: ClipboardList },
    { label: "إغلاق اليوم",  href: "/accountant/day-close", icon: Scale },
    { label: "نقاط الولاء",  href: "/accountant/loyalty",   icon: Star },
  ],
  platform_admin: [
    { label: "نظرة المنصة",  href: "/platform-admin",               icon: LayoutDashboard, exact: true },
    { label: "العيادات",      href: "/platform-admin/clinics",       icon: Building2 },
    { label: "الاشتراكات",   href: "/platform-admin/subscriptions", icon: CreditCard },
    { label: "اقتصاد المنصة", href: "/platform-admin/economy",       icon: Wallet },
    { label: "الأتمتة",       href: "/platform-admin/automation",    icon: Workflow },
    { label: "حملات المنصة", href: "/platform-admin/broadcast",     icon: Megaphone },
  ],
};
