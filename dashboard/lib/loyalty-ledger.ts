import "server-only";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

/* Points earned on a payment that was later refunded.

   The loyalty loop awards points when money is received. Give the money back and
   the points stay — so a patient can pay, collect the points, ask for a refund,
   and keep the reward the clinic bought with a payment it no longer has. Repeat
   that and the balance is free.

   So a refund takes back what that money earned, at the clinic's own current
   earn rate, and never below zero: if the points were already spent, the balance
   stops at nothing rather than going negative and blocking the patient's next
   redemption for a debt they cannot see.

   This lives outside app/actions on purpose. Every exported async function in a
   "use server" file is a network endpoint with an action id; a helper that moves
   points must not become one. */

type SB = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function clawBackLoyaltyOnRefund(
  sb: SB,
  clinicId: string,
  patientId: string,
  staffId: string,
  refundAmount: number,
): Promise<number> {
  try {
    const { data: cfg } = await sb
      .from("loyalty_settings")
      .select("is_active, points_per_omr")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (!cfg?.is_active) return 0;

    const rate = Number(cfg.points_per_omr ?? 1);
    const owed = Math.floor(Math.max(0, refundAmount) * rate);
    if (owed <= 0) return 0;

    const { data: p } = await sb
      .from("patients").select("loyalty_points").eq("id", patientId).maybeSingle();
    const balance = Number(p?.loyalty_points ?? 0);
    const take = Math.min(owed, balance);
    if (take <= 0) return 0;

    const after = balance - take;
    await sb.from("patients").update({ loyalty_points: after }).eq("id", patientId);
    await sb.from("loyalty_transactions").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      type: "adjust",
      points: -take,
      balance_after: after,
      note: `سحب نقاط مقابل استرداد ${refundAmount.toFixed(3)} ر.ع`,
      created_by: staffId,
    });
    return take;
  } catch {
    /* Best-effort: a loyalty hiccup must never fail a refund the patient is
       standing at the desk waiting for. */
    return 0;
  }
}
