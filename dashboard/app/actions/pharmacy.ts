"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

/* The pharmacy counter.

   A prescription is written and signed by a doctor (clinical), then handed over
   by whoever staffs the counter (operational). Those are different acts by
   different people, so dispensing lives here rather than in the doctor's module,
   and it is the moment stock actually moves. */

async function requireDispenser() {
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "receptionist") || hasRole(claims, "doctor"))) {
    throw new Error("غير مصرح");
  }
  return claims;
}

const rev = () => {
  revalidatePath("/clinic-admin/inventory");
  revalidatePath("/doctor/patients");
};

/** Hand over a signed prescription: deducts every stocked line, oldest expiry
    first, in one transaction. Refuses outright if any line is short. */
export async function dispensePrescription(prescriptionId: string) {
  const claims = await requireDispenser();
  const sb = await createServerSupabaseClient();

  const { data, error } = await sb.rpc("pharmacy_dispense", {
    p_prescription_id: prescriptionId,
    p_created_by: claims.sub,
  });

  if (error) {
    /* The function raises in Arabic for the cases a pharmacist can act on
       (short stock, unsigned script) — surface those verbatim rather than
       flattening them into "تعذّر". */
    const msg = error.message ?? "";
    const known = /الكمية غير كافية|الوصفة/.test(msg);
    return { ok: false as const, reason: known ? msg.replace(/^.*?ERROR:\s*/i, "") : "تعذّر صرف الوصفة" };
  }

  rev();
  return { ok: true as const, itemsDeducted: Number(data) || 0 };
}

/** Attach a prescription line to a stocked item, and say how much to hand over.
    Until a line is linked and quantified, dispensing it moves nothing. */
export async function linkPrescriptionItem(input: {
  item_row_id: string;
  inventory_item_id: string | null;
  quantity: number;
}) {
  const claims = await requireDispenser();
  const qty = Number(input.quantity);
  if (!(qty > 0)) return { ok: false as const, reason: "الكمية يجب أن تكون أكبر من صفر" };

  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("prescription_items")
    .update({ item_id: input.inventory_item_id || null, quantity: qty })
    .eq("id", input.item_row_id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر ربط الدواء بالمخزون" };

  rev();
  return { ok: true as const };
}
