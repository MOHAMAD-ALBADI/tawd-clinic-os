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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  clinic_admin: [
    { label: "لوحة التحكم",  href: "/clinic-admin",              icon: LayoutDashboard, exact: true },
    { label: "المواعيد",     href: "/clinic-admin/appointments",  icon: Calendar },
    { label: "المرضى",       href: "/clinic-admin/patients",      icon: UserCircle },
    { label: "الفواتير",     href: "/clinic-admin/invoices",      icon: CreditCard },
    { label: "الخدمات",      href: "/clinic-admin/services",      icon: Scissors },
    { label: "الكادر الطبي", href: "/clinic-admin/staff",         icon: Users },
    { label: "التسويق",      href: "/clinic-admin/marketing",     icon: Megaphone },
    { label: "التقارير",     href: "/clinic-admin/reports",       icon: BarChart3 },
    { label: "الإعدادات",   href: "/clinic-admin/settings",      icon: Settings },
  ],
  doctor: [
    { label: "جدولي اليوم", href: "/doctor",          icon: Stethoscope, exact: true },
    { label: "مرضاي",       href: "/doctor/patients",  icon: UserCircle },
  ],
  receptionist: [
    { label: "لوحة الاستقبال", href: "/reception",       icon: ClipboardList, exact: true },
    { label: "حجز موعد",       href: "/reception/book",  icon: Calendar },
  ],
  accountant: [
    { label: "لوحة المالية",  href: "/accountant",          icon: CreditCard, exact: true },
    { label: "الفواتير",      href: "/accountant/invoices", icon: ClipboardList },
    { label: "نقاط الولاء",  href: "/accountant/loyalty",  icon: Star },
  ],
  platform_admin: [
    { label: "نظرة المنصة", href: "/platform-admin",           icon: LayoutDashboard, exact: true },
    { label: "العيادات",     href: "/platform-admin/clinics",   icon: Building2 },
    { label: "الحملات",      href: "/platform-admin/broadcast", icon: Megaphone },
  ],
};
