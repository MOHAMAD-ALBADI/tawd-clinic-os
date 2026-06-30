import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PatientSearch, type DocPatient } from "@/components/doctor/patient-search";

export const metadata = { title: "مرضاي — طود" };

type J = { name: string; phone: string | null } | null;

export default async function DoctorPatientsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();

  // All of this doctor's appointments → dedupe into a patient list with visit counts.
  const { data } = await supabase
    .from("appointments")
    .select("patient_id, slot_time, patients(name, phone)")
    .eq("doctor_id", claims.sub)
    .is("deleted_at", null)
    .order("slot_time", { ascending: false });

  const map = new Map<string, DocPatient>();
  for (const a of data ?? []) {
    if (!a.patient_id) continue;
    const p = a.patients as unknown as J;
    const existing = map.get(a.patient_id);
    if (existing) {
      existing.visits += 1;
    } else {
      map.set(a.patient_id, {
        id: a.patient_id,
        name: p?.name ?? "مجهول",
        phone: p?.phone ?? null,
        visits: 1,
        last: a.slot_time, // first seen = latest visit (ordered desc)
      });
    }
  }
  const patients = [...map.values()];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white">مرضاي</h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(148,163,184,0.6)" }}>{patients.length} مريض في سجلاتك</p>
      </div>
      <PatientSearch patients={patients} />
    </div>
  );
}
