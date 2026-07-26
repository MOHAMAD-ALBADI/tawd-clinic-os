import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PatientSearch, type DocPatient } from "@/components/doctor/patient-search";

export const metadata = { title: "مرضاي — طود" };
export const dynamic = "force-dynamic";

export default async function DoctorPatientsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const sb = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  /* The clinic's patients, not a projection of this doctor's diary.
     The old page derived the list from appointments, so a doctor with none saw
     an empty screen in a clinic full of patients — and could not look up the
     one phoning about a colleague's treatment. RLS keeps this to their own
     clinic; "mine" is computed below and offered as a filter. */
  const [{ data: people }, { data: myAppts }, { data: allAppts }, { data: hist }, { data: planItems }] =
    await Promise.all([
      sb.from("patients").select("id, name, phone").is("deleted_at", null).limit(5000),
      sb.from("appointments")
        .select("patient_id, slot_time")
        .eq("doctor_id", claims.sub).eq("status", "completed").is("deleted_at", null)
        .order("slot_time", { ascending: false }).limit(3000),
      sb.from("appointments")
        .select("patient_id, slot_time")
        .in("status", ["scheduled", "confirmed"]).is("deleted_at", null)
        .gte("slot_time", nowIso).order("slot_time").limit(3000),
      sb.from("medical_histories").select("patient_id, allergies, chronic_diseases").limit(5000),
      /* outstanding work on plans the patient has already agreed to */
      sb.from("treatment_plan_items")
        .select("status, treatment_plans!plan_id(patient_id, status)")
        .eq("status", "pending").limit(3000),
    ]);

  const visits = new Map<string, number>();
  const lastSeen = new Map<string, string>();
  for (const a of myAppts ?? []) {
    const pid = a.patient_id as string;
    visits.set(pid, (visits.get(pid) ?? 0) + 1);
    if (!lastSeen.has(pid)) lastSeen.set(pid, a.slot_time as string); // ordered desc
  }

  const nextAppt = new Map<string, string>();
  for (const a of allAppts ?? []) {
    const pid = a.patient_id as string;
    if (!nextAppt.has(pid)) nextAppt.set(pid, a.slot_time as string); // ordered asc
  }

  const allergyOf = new Map<string, string[]>();
  const chronicOf = new Map<string, string[]>();
  for (const h of hist ?? []) {
    const pid = h.patient_id as string;
    const a = (h.allergies as string[] | null) ?? [];
    const c = (h.chronic_diseases as string[] | null) ?? [];
    if (a.length) allergyOf.set(pid, a);
    if (c.length) chronicOf.set(pid, c);
  }

  const openItems = new Map<string, number>();
  for (const it of planItems ?? []) {
    const plan = it.treatment_plans as unknown as { patient_id: string; status: string } | null;
    if (!plan) continue;
    if (plan.status !== "accepted" && plan.status !== "in_progress") continue;
    openItems.set(plan.patient_id, (openItems.get(plan.patient_id) ?? 0) + 1);
  }

  const patients: DocPatient[] = (people ?? []).map((p) => {
    const id = p.id as string;
    return {
      id,
      name: (p.name as string) ?? "مريض",
      phone: (p.phone as string | null) ?? null,
      visits: visits.get(id) ?? 0,
      last: lastSeen.get(id) ?? null,
      next: nextAppt.get(id) ?? null,
      allergies: allergyOf.get(id) ?? [],
      chronic: chronicOf.get(id) ?? [],
      openPlanItems: openItems.get(id) ?? 0,
      mine: (visits.get(id) ?? 0) > 0,
    };
  });

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">PATIENTS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">مرضاي</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          من عالجتهم، ومن يحتاج متابعة، وكل مرضى العيادة عند البحث
        </p>
      </div>

      <PatientSearch patients={patients} />
    </div>
  );
}
