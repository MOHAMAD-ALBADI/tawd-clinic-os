"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/* Which services this doctor is bookable for.

   doctor_services already decides this: both booking paths — reception and the
   public page — filter candidate doctors through it whenever any mapping exists
   for a service, and fall back to every active doctor when none does. That is a
   sensible default and a bad silence: nothing in the product could read or write
   the table, so a clinic that mapped one service by hand in Supabase silently
   removed every unmapped doctor from it, and no doctor could see why they had
   stopped receiving those bookings. */

async function requireDoctor() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");
  return claims;
}

export async function setMyServices(serviceIds: string[]) {
  const claims = await requireDoctor();
  const sb = await createServerSupabaseClient();

  /* Only services of this doctor's own clinic, resolved server-side. An id from
     elsewhere would otherwise create a mapping across tenants. */
  const { data: mine } = await sb.from("services")
    .select("id").eq("clinic_id", claims.clinic_id).eq("is_active", true);
  const allowed = new Set((mine ?? []).map((s) => s.id as string));
  const wanted = [...new Set(serviceIds)].filter((id) => allowed.has(id));

  const { data: existing } = await sb.from("doctor_services")
    .select("id, service_id, is_active").eq("doctor_id", claims.sub);

  const have = new Map((existing ?? []).map((r) => [r.service_id as string, r]));

  /* Deactivate rather than delete, and reactivate rather than re-insert: the
     row may carry history, and a delete/insert cycle churns ids for nothing. */
  const toDisable = (existing ?? [])
    .filter((r) => r.is_active && !wanted.includes(r.service_id as string))
    .map((r) => r.id as string);
  if (toDisable.length) {
    await sb.from("doctor_services").update({ is_active: false }).in("id", toDisable);
  }

  const toEnable = wanted.filter((id) => have.get(id) && !have.get(id)!.is_active)
    .map((id) => have.get(id)!.id as string);
  if (toEnable.length) {
    await sb.from("doctor_services").update({ is_active: true }).in("id", toEnable);
  }

  const toInsert = wanted.filter((id) => !have.has(id));
  if (toInsert.length) {
    const { error } = await sb.from("doctor_services").insert(
      toInsert.map((service_id) => ({
        clinic_id: claims.clinic_id, doctor_id: claims.sub, service_id, is_active: true,
      }))
    );
    if (error) return { ok: false as const, reason: `تعذّر الحفظ: ${error.message}` };
  }

  revalidatePath("/doctor/settings");
  return { ok: true as const, count: wanted.length };
}
