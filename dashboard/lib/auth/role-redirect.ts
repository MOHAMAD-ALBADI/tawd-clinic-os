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

/** One account can hold several roles (e.g. reception + accounting on one front-desk PC). */
export function hasRole(
  claims: { role: Role; all_roles?: Role[] },
  role: Role
): boolean {
  return claims.role === role || (claims.all_roles ?? []).includes(role);
}

/** All roles the account holds, primary first, deduped. */
export function rolesOf(claims: { role: Role; all_roles?: Role[] }): Role[] {
  return [...new Set([claims.role, ...(claims.all_roles ?? [])])];
}

export const ROLE_LABELS: Record<Role, string> = {
  clinic_admin:   "مدير العيادة",
  doctor:         "طبيب",
  receptionist:   "موظف استقبال",
  accountant:     "محاسب",
  platform_admin: "مدير المنصة",
};
