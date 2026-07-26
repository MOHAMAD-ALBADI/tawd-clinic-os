"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CODE_BY_KEY, SURFACES } from "@/lib/dental";

/* Writing to the tooth chart.

   Only clinical roles write here. Reception and accounting can see a patient's
   file but a chart entry is a clinical finding, and the person who records it
   is the person answerable for it. */

async function requireClinician() {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  if (claims.role !== "doctor" && claims.role !== "clinic_admin") {
    throw new Error("تسجيل موجودات الأسنان للأطباء فقط");
  }
  return claims;
}

const VALID_SURFACES = new Set(SURFACES.map((s) => s.key));

/** A tooth number that is not FDI would be accepted by the column check only by
    accident; rejecting it here gives a readable message instead. */
function validTooth(t: number) {
  const q = Math.floor(t / 10);
  const p = t % 10;
  if (q >= 1 && q <= 4) return p >= 1 && p <= 8;
  if (q >= 5 && q <= 8) return p >= 1 && p <= 5;
  return false;
}

export async function addChartEntry(input: {
  patientId: string;
  tooth: number;
  surfaces: string[];
  code: string;
  note?: string;
  /** a treatment is recorded as done; a finding is open until resolved */
  status?: "active" | "planned";
  apptId?: string;
}) {
  const claims = await requireClinician();

  const tooth = Math.floor(Number(input.tooth));
  if (!validTooth(tooth)) return { ok: false as const, reason: "رقم السن غير صالح" };

  const def = CODE_BY_KEY[input.code];
  if (!def) return { ok: false as const, reason: "رمز غير معروف" };

  const surfaces = [...new Set((input.surfaces ?? []).filter((s) => VALID_SURFACES.has(s as never)))];

  const sb = await createServerSupabaseClient();
  const { data, error } = await sb.from("dental_chart_entries").insert({
    patient_id: input.patientId,
    doctor_id: claims.sub,
    appt_id: input.apptId ?? null,
    tooth,
    surfaces,
    kind: def.kind,
    code: def.code,
    note: input.note?.trim() || null,
    /* Recording a treatment means it happened. A finding stays open until
       something is done about it — that is the whole point of charting one. */
    status: def.kind === "treatment" ? "resolved" : (input.status ?? "active"),
    resolved_at: def.kind === "treatment" ? new Date().toISOString() : null,
  }).select("id").single();

  if (error) return { ok: false as const, reason: `تعذّر الحفظ: ${error.message}` };

  revalidatePath(`/doctor/patients/${input.patientId}`);
  revalidatePath(`/clinic-admin/patients/${input.patientId}`);
  return { ok: true as const, id: data.id as string };
}

/** Close a finding — it was treated, or it was not there.

    Kept as a status change rather than a delete: a caries lesion that was
    charted and then filled is the clinical history, and erasing it loses why
    the filling exists. */
export async function resolveChartEntry(id: string, patientId: string) {
  await requireClinician();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("dental_chart_entries")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, reason: "تعذّر التحديث" };
  revalidatePath(`/doctor/patients/${patientId}`);
  return { ok: true as const };
}

/** Remove an entry recorded by mistake.

    Only the clinician who wrote it, and only within the hour. After that it is
    part of the record and gets closed, not erased — a chart that can be quietly
    rewritten is not a medical record. */
export async function deleteChartEntry(id: string, patientId: string) {
  const claims = await requireClinician();
  const sb = await createServerSupabaseClient();

  const { data: row } = await sb.from("dental_chart_entries")
    .select("doctor_id, created_at").eq("id", id).maybeSingle();
  if (!row) return { ok: false as const, reason: "غير موجود" };

  if (row.doctor_id !== claims.sub) {
    return { ok: false as const, reason: "لا يمكن حذف تسجيل طبيب آخر — أغلقه بدل حذفه" };
  }
  const ageMin = (Date.now() - new Date(row.created_at as string).getTime()) / 60_000;
  if (ageMin > 60) {
    return { ok: false as const, reason: "مضى أكثر من ساعة — أغلق التسجيل بدل حذفه ليبقى في السجل" };
  }

  const { error } = await sb.from("dental_chart_entries").delete().eq("id", id);
  if (error) return { ok: false as const, reason: "تعذّر الحذف" };
  revalidatePath(`/doctor/patients/${patientId}`);
  return { ok: true as const };
}
