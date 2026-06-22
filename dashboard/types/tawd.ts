export type Role =
  | "clinic_admin"
  | "doctor"
  | "receptionist"
  | "accountant"
  | "platform_admin";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface UserClaims {
  sub: string;
  email: string;
  role: Role;
  clinic_id: string;
  all_roles: Role[];
  is_multi_role: boolean;
}

export interface KPIData {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  variant: "teal" | "gold" | "success" | "danger" | "slate";
}

export interface TimelineSlot {
  id: string;
  patient_name: string;
  time: string;
  service: string;
  status: AppointmentStatus;
  doctor_name?: string;
}
