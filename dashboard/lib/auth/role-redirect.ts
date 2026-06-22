import type { Role } from "@/types/tawd";

export const ROLE_HOME: Record<Role, string> = {
  clinic_admin:   "/clinic-admin",
  doctor:         "/doctor",
  receptionist:   "/reception",
  accountant:     "/accountant",
  platform_admin: "/platform-admin",
};

export function getRoleHome(role: Role): string {
  return ROLE_HOME[role] ?? "/clinic-admin";
}

export const ROLE_LABELS: Record<Role, string> = {
  clinic_admin:   "مدير العيادة",
  doctor:         "طبيب",
  receptionist:   "موظف استقبال",
  accountant:     "محاسب",
  platform_admin: "مدير المنصة",
};
