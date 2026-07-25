"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  return claims;
}
const rev = () => revalidatePath("/clinic-admin/marketing/templates");

/** notification_template_type enum — the clinic picks what the message is FOR. */
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

/** Placeholders the automation replaces at send time. Kept in one place so the
    editor can show the clinic exactly what it may use. */
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

/** Extract the {{placeholders}} actually used, so `variables` stays accurate
    without the clinic having to maintain it by hand. */
function usedVariables(...bodies: (string | undefined)[]): string[] {
  const found = new Set<string>();
  for (const b of bodies) {
    for (const m of (b ?? "").matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) {
      found.add(`{{${m[1].toLowerCase()}}}`);
    }
  }
  return [...found];
}

export async function saveTemplate(input: TemplateInput) {
  const claims = await requireAdmin();
  const name = (input.name ?? "").trim();
  const bodyAr = (input.body_ar ?? "").trim();
  if (!name) return { ok: false as const, reason: "اسم القالب مطلوب" };
  if (!bodyAr) return { ok: false as const, reason: "نص الرسالة (عربي) مطلوب" };
  if (!TEMPLATE_TYPES.includes(input.template_type)) {
    return { ok: false as const, reason: "نوع القالب غير صالح" };
  }

  const sb = await createServerSupabaseClient();
  const row = {
    clinic_id: claims.clinic_id,
    name,
    template_type: input.template_type,
    channel: input.channel || "whatsapp",
    body_ar: bodyAr,
    body_en: input.body_en?.trim() || null,
    variables: usedVariables(bodyAr, input.body_en),
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const { error } = input.id
    ? await sb.from("notification_templates").update(row)
        .eq("id", input.id).eq("clinic_id", claims.clinic_id)
    : await sb.from("notification_templates").insert(row);

  if (error) return { ok: false as const, reason: "تعذّر حفظ القالب" };
  rev();
  return { ok: true as const };
}

/** Enable/disable without deleting — automation checks is_active. */
export async function toggleTemplate(id: string, isActive: boolean) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("notification_templates")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر تغيير الحالة" };
  rev();
  return { ok: true as const };
}

export async function deleteTemplate(id: string) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("notification_templates").delete()
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر حذف القالب" };
  rev();
  return { ok: true as const };
}
