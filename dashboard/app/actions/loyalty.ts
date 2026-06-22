"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { revalidatePath } from "next/cache";

export async function updateLoyaltySettings(data: {
  points_per_visit: number;
  points_per_referral: number;
  redemption_rate: number;
  is_active: boolean;
}) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("loyalty_settings")
    .upsert(
      {
        clinic_id:           claims.clinic_id,
        points_per_visit:    data.points_per_visit,
        points_per_referral: data.points_per_referral,
        redemption_rate:     data.redemption_rate,
        is_active:           data.is_active,
        updated_at:          new Date().toISOString(),
      },
      { onConflict: "clinic_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/clinic-admin");
  return { success: true };
}
