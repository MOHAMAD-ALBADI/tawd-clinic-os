"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";

/* Manual movements on a patient's points.

   Points are money the clinic owes: a balance can be redeemed against a bill.
   So an adjustment is a financial act and behaves like one — it needs a reason,
   it is written to the ledger with who did it, and it can never silently take a
   balance negative. */

async function requireCashier() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) {
    throw new Error("غير مصرح");
  }
  return claims;
}

export async function adjustPoints(input: {
  patientId: string;
  /** positive grants, negative deducts */
  points: number;
  note: string;
}) {
  const claims = await requireCashier();
  const sb = await createServerSupabaseClient();

  const delta = Math.trunc(Number(input.points) || 0);
  if (delta === 0) return { ok: false as const, reason: "أدخل عدد نقاط غير صفر" };
  if (Math.abs(delta) > 100000) return { ok: false as const, reason: "العدد كبير بشكل غير معقول" };

  const note = input.note.trim();
  /* A points movement with no stated reason is indistinguishable from a
     mistake when it is read back six months later. */
  if (!note) return { ok: false as const, reason: "اكتب سبب التعديل — يبقى في السجل" };

  const { data: patient } = await sb.from("patients")
    .select("id, name, loyalty_points").eq("id", input.patientId)
    .eq("clinic_id", claims.clinic_id).is("deleted_at", null).maybeSingle();
  if (!patient) return { ok: false as const, reason: "المريض غير موجود" };

  const before = Number(patient.loyalty_points ?? 0);
  const after = before + delta;
  if (after < 0) {
    return { ok: false as const, reason: `الرصيد ${before} نقطة — لا يمكن الخصم أكثر منه` };
  }

  const { error: uerr } = await sb.from("patients")
    .update({ loyalty_points: after }).eq("id", input.patientId).eq("clinic_id", claims.clinic_id);
  if (uerr) return { ok: false as const, reason: "تعذّر تحديث الرصيد" };

  /* Ledger second: if this fails the balance is still right and the gap is
     visible, which is recoverable. The reverse would hide a real movement. */
  const { error: lerr } = await sb.from("loyalty_transactions").insert({
    clinic_id: claims.clinic_id,
    patient_id: input.patientId,
    type: "adjust",
    points: delta,
    balance_after: after,
    note,
    created_by: claims.sub,
  });

  revalidatePath("/accountant/loyalty");
  if (lerr) {
    return { ok: true as const, after, warning: "عُدّل الرصيد لكن تعذّر تسجيله في السجل" };
  }
  return { ok: true as const, after };
}
