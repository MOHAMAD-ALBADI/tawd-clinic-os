"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SuraSettings = {
  identity: string;
  tone: string;
  custom_instructions: string;
  payment_info: string;
  doctors: string[];
  knowledge_base: string;
};

export async function updateSuraSettings(data: SuraSettings) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();

  const override = {
    identity: data.identity.trim(),
    tone: data.tone.trim(),
    custom_instructions: data.custom_instructions.trim(),
    payment_info: data.payment_info.trim(),
    doctors: (data.doctors ?? []).map((d) => d.trim()).filter(Boolean),
    knowledge_base: data.knowledge_base.trim(),
  };

  const { error } = await supabase
    .from("tawd_clinic_settings")
    .upsert(
      { clinic_id: claims.clinic_id, sura_personality_override: override },
      { onConflict: "clinic_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/clinic-admin/settings");
  // Sura reads this live from the DB on every message — no redeploy needed.
}
