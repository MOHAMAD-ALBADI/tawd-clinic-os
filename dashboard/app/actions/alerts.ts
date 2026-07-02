"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Mark a Sura emergency alert as acknowledged so it drops off the live banner. */
export async function acknowledgeAlert(alertId: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("sura_alerts")
    .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("clinic_id", claims.clinic_id); // RLS also enforces this; belt and suspenders

  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin");
}
