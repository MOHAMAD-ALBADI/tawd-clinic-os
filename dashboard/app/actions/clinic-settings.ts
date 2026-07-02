"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateClinicInfo(data: {
  name: string;
  name_ar?: string;
  country_code: string;
  timezone: string;
  currency: "OMR" | "SAR" | "AED" | "USD";
  vat_enabled: boolean;
}) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("tawd_clinics")
    .update({
      name:         data.name.trim(),
      name_ar:      data.name_ar?.trim() || null,
      country_code: data.country_code,
      timezone:     data.timezone,
      currency:     data.currency,
      vat_enabled:  data.vat_enabled,
    })
    .eq("id", claims.clinic_id);

  if (error) throw new Error(error.message);

  revalidatePath("/clinic-admin/settings");
  revalidatePath("/clinic-admin");
}

export async function updateWorkingHours(hours: Record<string, { open: string; close: string } | null>) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();

  // Upsert clinic_settings row
  const { error } = await supabase
    .from("tawd_clinic_settings")
    .upsert(
      { clinic_id: claims.clinic_id, working_hours: hours },
      { onConflict: "clinic_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/settings");
}

/** Set the clinic's Google review link (used by Sura's post-visit follow-up message). */
export async function updateReviewLink(url: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const clean = url.trim();
  if (clean && !/^https?:\/\//i.test(clean)) throw new Error("الرابط يجب أن يبدأ بـ https://");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("tawd_clinic_settings")
    .upsert(
      { clinic_id: claims.clinic_id, google_review_url: clean || null },
      { onConflict: "clinic_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/settings");
}
