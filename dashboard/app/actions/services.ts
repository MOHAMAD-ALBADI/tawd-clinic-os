"use server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* The services table already carried category, name_ar and vat_applicable; the
   form set none of them, so every service was uncategorised, English-only and
   silently tax-exempt. Categories are the clinic's own hierarchy — "تقويم",
   "جراحة", "أشعة" — and vat_applicable is what makes the invoice's tax toggle
   default correctly instead of asking the receptionist to remember. */

export type ServiceInput = {
  name: string;
  name_ar?: string;
  price: number;
  duration_minutes?: number;
  description?: string;
  category?: string;
  vat_applicable?: boolean;
};

async function requireAdmin() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  return claims;
}

const rev = () => {
  revalidatePath("/clinic-admin/services");
  revalidatePath("/clinic-admin/appointments");
  revalidatePath("/clinic-admin/finance/invoices");
  revalidatePath("/clinic-admin");
};

function normalise(data: ServiceInput) {
  return {
    name: data.name.trim(),
    name_ar: data.name_ar?.trim() || null,
    price: Number(data.price) || 0,
    duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : null,
    description: data.description?.trim() || null,
    category: data.category?.trim() || null,
    vat_applicable: data.vat_applicable ?? false,
  };
}

export async function createService(data: ServiceInput) {
  const claims = await requireAdmin();
  if (!data.name?.trim()) return { ok: false as const, reason: "اسم الخدمة مطلوب" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services").insert({
    clinic_id: claims.clinic_id,
    ...normalise(data),
    is_active: true,
  });
  if (error) return { ok: false as const, reason: "تعذّر إضافة الخدمة" };
  rev();
  return { ok: true as const };
}

export async function updateService(id: string, data: ServiceInput) {
  const claims = await requireAdmin();
  if (!data.name?.trim()) return { ok: false as const, reason: "اسم الخدمة مطلوب" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services")
    .update({ ...normalise(data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر تحديث الخدمة" };
  rev();
  return { ok: true as const };
}

export async function deleteService(id: string) {
  const claims = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  // A service attached to history is disabled, never erased — deleting it would
  // strand the appointments and invoice lines that name it.
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("service_id", id)
    .eq("clinic_id", claims.clinic_id);
  if ((count ?? 0) > 0) {
    return { ok: false as const, reason: `الخدمة مرتبطة بـ ${count} موعد — عطّلها بدل حذفها` };
  }
  const { error } = await supabase.from("services").delete().eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر حذف الخدمة" };
  rev();
  return { ok: true as const };
}

export async function toggleServiceStatus(id: string, isActive: boolean) {
  const claims = await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر تغيير الحالة" };
  rev();
  return { ok: true as const };
}
