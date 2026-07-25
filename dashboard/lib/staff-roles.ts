/* Role vocabulary shared by the staff actions and the team UI.

   Lives outside app/actions because a "use server" file may only export async
   functions — exporting a constant from one crashes at runtime while typecheck
   and build both pass. */

export const APP_ROLES = ["clinic_admin", "doctor", "receptionist", "accountant"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** app Role name → staff_role enum value in Postgres */
export const TO_DB_ROLE: Record<AppRole, string> = {
  clinic_admin: "admin",
  doctor: "doctor",
  receptionist: "receptionist",
  accountant: "accountant",
};

/** staff_role enum value (or an app name already) → app Role name */
export const TO_APP_ROLE: Record<string, AppRole> = {
  admin: "clinic_admin",
  clinic_admin: "clinic_admin",
  doctor: "doctor",
  receptionist: "receptionist",
  accountant: "accountant",
};

export const ROLE_LABEL_AR: Record<AppRole, string> = {
  clinic_admin: "مدير العيادة",
  doctor: "طبيب",
  receptionist: "موظف استقبال",
  accountant: "محاسب",
};

export const ROLE_COLOR: Record<AppRole, string> = {
  clinic_admin: "#5dd9cb",
  doctor: "#38bdf8",
  receptionist: "#fbbf24",
  accountant: "#34d399",
};

export const toDbRole = (r: AppRole) => TO_DB_ROLE[r];
export const toAppRole = (r: string): AppRole | null => TO_APP_ROLE[r] ?? null;
