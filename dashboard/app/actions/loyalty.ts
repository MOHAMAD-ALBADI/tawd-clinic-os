"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { revalidatePath } from "next/cache";

/* The five numbers that actually drive the loyalty engine (see
   app/actions/accountant.ts): points are earned per rial paid, each point is
   worth redemption_rate rials, redemption needs a minimum balance and is capped
   at a share of the invoice, and an idle balance expires after expiry_months.

   points_per_visit and points_per_referral live in the table but no code reads
   them — the editor used to present them as the rules while quietly resetting
   the real ones to defaults on every save. They are left untouched here rather
   than deleted, so a future per-visit scheme can pick them up. */

export type LoyaltyInput = {
  is_active: boolean;
  points_per_omr: number;
  redemption_rate: number;
  min_redeem_points: number;
  max_redeem_pct: number;
  expiry_months: number;
};

export async function updateLoyaltySettings(data: LoyaltyInput) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");

  const pointsPerOmr = Math.max(0, Number(data.points_per_omr) || 0);
  const rate = Math.max(0, Number(data.redemption_rate) || 0);
  const minRedeem = Math.max(1, Math.floor(Number(data.min_redeem_points) || 1));
  const maxPct = Math.min(100, Math.max(1, Math.floor(Number(data.max_redeem_pct) || 1)));
  const expiry = Math.max(1, Math.floor(Number(data.expiry_months) || 1));

  const supabase = await createServerSupabaseClient();

  /* Update-then-insert rather than upsert: an upsert with a partial column list
     rewrites the omitted columns to their defaults, which is how saving this
     form used to wipe settings the form did not show. */
  const patch = {
    is_active: data.is_active,
    points_per_omr: pointsPerOmr,
    redemption_rate: rate,
    min_redeem_points: minRedeem,
    max_redeem_pct: maxPct,
    expiry_months: expiry,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("loyalty_settings").select("id").eq("clinic_id", claims.clinic_id).maybeSingle();

  const { error } = existing
    ? await supabase.from("loyalty_settings").update(patch).eq("clinic_id", claims.clinic_id)
    : await supabase.from("loyalty_settings").insert({ clinic_id: claims.clinic_id, ...patch });

  if (error) return { ok: false as const, reason: "تعذّر حفظ إعدادات الولاء" };

  revalidatePath("/clinic-admin");
  revalidatePath("/clinic-admin/marketing/loyalty");
  revalidatePath("/accountant/loyalty");
  return { ok: true as const };
}
