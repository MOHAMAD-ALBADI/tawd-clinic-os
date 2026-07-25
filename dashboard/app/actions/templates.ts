"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TEMPLATE_TYPES, type TemplateInput } from "@/lib/template-meta";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  return claims;
}
const rev = () => revalidatePath("/clinic-admin/marketing/templates");

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
