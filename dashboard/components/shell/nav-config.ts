import type { Role } from "@/types/tawd";
import type { ModuleKey } from "@/lib/modules";
import {
  LayoutDashboard,
  Calendar,
  CalendarPlus,
  CalendarClock,
  Lock,
  PhoneCall,
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
  Coins, TrendingUp,
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
  /** Hidden unless the clinic's contract includes this module. Items with no
      module are core and always shown. */
  module?: ModuleKey;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  clinic_admin: [
    { label: "لوحة التحكم",  href: "/clinic-admin",              icon: LayoutDashboard, exact: true },

    { section: "العيادة اليوم",
      label: "المواعيد",     href: "/clinic-admin/appointments",  icon: Calendar },
    { label: "المرضى",       href: "/clinic-admin/patients",      icon: UserCircle },
    { label: "خطط العلاج",   href: "/clinic-admin/treatment-plans", icon: ClipboardList, module: "treatment_plans" },

    /* Invoicing, expenses, payroll, commissions and the online gateway all
       answer "where is the clinic's money?" — one entry, tabs inside. */
    { section: "المال",
      label: "المالية",      href: "/clinic-admin/finance",        icon: Wallet },
    { label: "التأمين",      href: "/clinic-admin/insurance",      icon: ShieldCheck, module: "insurance" },

    { section: "الموارد",
      label: "الخدمات",      href: "/clinic-admin/services",      icon: Scissors },
    { label: "المخزون",      href: "/clinic-admin/inventory",     icon: Boxes, module: "inventory" },
    { label: "الكادر الطبي", href: "/clinic-admin/staff",         icon: Users },

    { section: "النمو",
      label: "التسويق",      href: "/clinic-admin/marketing",     icon: Megaphone, module: "marketing" },
    { label: "تحليلات سُرى",  href: "/clinic-admin/sura-analytics", icon: Bot, module: "sura" },
    { label: "التقارير",     href: "/clinic-admin/reports",       icon: BarChart3, module: "reports" },

    { section: "النظام",
      label: "الإعدادات",   href: "/clinic-admin/settings",      icon: Settings },
  ],
  /* No role menu carries "ملفي الشخصي".

     The sidebar footer already makes the whole identity block — avatar, name,
     roles — a link to /profile, which is where people look for their own
     account anyway. Repeating it as a nav item was redundant on a single-role
     menu and actively wrong on a merged one: the menus concatenate, so the
     duplicate landed in the MIDDLE of the list, between the reception block and
     the finance block. Whoever holds both roles saw their profile filed under
     nothing, halfway down. */
  doctor: [
    { section: "عملي اليوم",
      label: "جدولي اليوم",    href: "/doctor",                 icon: Stethoscope, exact: true },
    { label: "مواعيدي",        href: "/doctor/appointments",    icon: Calendar },
    { label: "مرضاي",          href: "/doctor/patients",        icon: UserCircle },
    { label: "خطط علاجي",      href: "/doctor/treatment-plans", icon: ClipboardList, module: "treatment_plans" },

    { section: "أنا",
      label: "دوامي وإجازاتي", href: "/doctor/schedule",        icon: CalendarClock },
    { label: "إحصائياتي",      href: "/doctor/stats",           icon: BarChart3 },
    /* A gear labelled "ملفي الشخصي" reads as Settings and sent doctors looking
       for settings into a profile form. They are two things now. */
    { label: "إعداداتي",       href: "/doctor/settings",        icon: Settings },
  ],

  /* Sections earn their keep here. Reception and finance were flat lists, which
     is fine alone and unreadable merged — ten unlabelled rows. Headed, a
     front-desk-plus-cashier account reads as the two jobs it actually is. */
  receptionist: [
    { section: "الاستقبال",
      label: "لوحة اليوم",     href: "/reception",           icon: ClipboardList, exact: true },
    { label: "التقويم",        href: "/reception/calendar",   icon: Calendar },
    { label: "حجز موعد",       href: "/reception/book",       icon: CalendarPlus },
    { label: "المرضى",         href: "/reception/patients",   icon: UserCircle },
    { label: "المتابعة",       href: "/reception/followups",  icon: PhoneCall },
  ],
  accountant: [
    { section: "المالية",
      label: "لوحة المالية",   href: "/accountant",           icon: CreditCard, exact: true },
    { label: "الفواتير",       href: "/accountant/invoices",  icon: Receipt },
    /* Money received had no screen at all — only totals. A payment entered for
       the wrong patient, or twice, or with a digit too many, was invisible. */
    { label: "الدفعات",        href: "/accountant/payments",  icon: Coins },
    /* Debt by person, not by document — a patient with four part-paid invoices
       appeared four times and nowhere did the product total them up. */
    { label: "حسابات المرضى",  href: "/accountant/patients",  icon: Users },
    /* The section could say how much came in and never what it came from. */
    { label: "تحليل الإيراد",  href: "/accountant/revenue",   icon: TrendingUp },
    /* Oman VAT is quarterly with a 500–5000 r.o. penalty for filing late, and
       the product charged the tax without ever reporting it. */
    { label: "الضريبة",        href: "/accountant/vat",       icon: Scale },
    { label: "إغلاق اليوم",    href: "/accountant/day-close", icon: Lock },
    { label: "نقاط الولاء",    href: "/accountant/loyalty",   icon: Star, module: "loyalty" },
  ],
  platform_admin: [
    { label: "نظرة المنصة",  href: "/platform-admin",               icon: LayoutDashboard, exact: true },

    { section: "العملاء",
      label: "العيادات",      href: "/platform-admin/clinics",       icon: Building2 },
    { label: "الاشتراكات",   href: "/platform-admin/subscriptions", icon: CreditCard },

    { section: "المال",
      label: "التحصيل",       href: "/platform-admin/billing",       icon: Receipt },
    { label: "اقتصاد المنصة", href: "/platform-admin/economy",       icon: Wallet },

    { section: "التشغيل",
      label: "الأتمتة",       href: "/platform-admin/automation",    icon: Workflow },
    { label: "حملات المنصة", href: "/platform-admin/broadcast",     icon: Megaphone },

    { section: "النظام",
      label: "الإعدادات",     href: "/platform-admin/settings",      icon: Settings },
  ],
};
