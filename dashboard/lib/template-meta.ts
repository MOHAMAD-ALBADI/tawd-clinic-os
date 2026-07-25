/* Template constants shared by the server action and the client editor.

   These MUST NOT live in app/actions/templates.ts: a file marked "use server" may
   only export async functions, so exporting these arrays from there crashed the
   page as soon as the client component imported them. Plain module = safe for both
   sides. */

/** notification_template_type enum — what the message is FOR. */
export const TEMPLATE_TYPES = [
  "appointment_reminder_24h",
  "appointment_reminder_2h",
  "appointment_confirmation",
  "appointment_cancellation",
  "invoice_ready",
  "payment_received",
  "no_show_followup",
  "sura_welcome",
  "custom",
] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

/** Placeholders the automation replaces at send time. */
export const TEMPLATE_VARIABLES = [
  "{{patient_name}}", "{{clinic_name}}", "{{doctor_name}}",
  "{{date}}", "{{time}}", "{{service}}", "{{amount}}",
] as const;

export type TemplateInput = {
  id?: string;
  name: string;
  template_type: TemplateType;
  channel: string;          // channel_type enum: whatsapp / sms / email…
  body_ar: string;
  body_en?: string;
  is_active?: boolean;
};

/** Arabic labels for the real enum values. */
export const TYPE_AR: Record<string, string> = {
  appointment_reminder_24h: "تذكير موعد (24 ساعة)",
  appointment_reminder_2h: "تذكير موعد (ساعتين)",
  appointment_confirmation: "تأكيد موعد",
  appointment_cancellation: "إلغاء موعد",
  invoice_ready: "الفاتورة جاهزة",
  payment_received: "تأكيد استلام دفعة",
  no_show_followup: "متابعة عدم الحضور",
  sura_welcome: "ترحيب سُرى",
  custom: "مخصّص",
};
