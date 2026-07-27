import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { PatientDirectory, type DirectoryPatient } from "@/components/reception/patient-directory";
import { UserPlus } from "lucide-react";

export const metadata = { title: "المرضى — طود" };
export const dynamic = "force-dynamic";

export default async function ReceptionPatientsPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const [{ data: people }, { data: visits }, { data: future }, { data: hist }, { data: invoices }] =
    await Promise.all([
      sb.from("patients").select("id, name, phone, gender, dob")
        .eq("clinic_id", claims.clinic_id).is("deleted_at", null).limit(5000),
      sb.from("appointments").select("patient_id, slot_time")
        .eq("clinic_id", claims.clinic_id).eq("status", "completed").is("deleted_at", null)
        .order("slot_time", { ascending: false }).limit(5000),
      sb.from("appointments").select("patient_id, slot_time")
        .eq("clinic_id", claims.clinic_id).in("status", ["scheduled", "confirmed"]).is("deleted_at", null)
        .gte("slot_time", nowIso).order("slot_time").limit(3000),
      sb.from("medical_histories").select("patient_id, allergies, chronic_diseases").limit(5000),
      /* What is still owed, so the desk can ask while the patient is here
         rather than posting a reminder next week. */
      sb.from("invoices").select("patient_id, total, status")
        .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
        .in("status", ["sent", "overdue", "partially_paid"]).limit(3000),
    ]);

  const last = new Map<string, string>();
  for (const v of visits ?? []) {
    const pid = v.patient_id as string;
    if (!last.has(pid)) last.set(pid, v.slot_time as string);
  }
  const next = new Map<string, string>();
  for (const a of future ?? []) {
    const pid = a.patient_id as string;
    if (!next.has(pid)) next.set(pid, a.slot_time as string);
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
  const owed = new Map<string, number>();
  for (const inv of invoices ?? []) {
    const pid = inv.patient_id as string;
    owed.set(pid, (owed.get(pid) ?? 0) + Number(inv.total ?? 0));
  }

  const patients: DirectoryPatient[] = (people ?? []).map((p) => {
    const id = p.id as string;
    return {
      id,
      name: (p.name as string) ?? "مريض",
      phone: (p.phone as string | null) ?? null,
      gender: (p.gender as string | null) ?? null,
      dob: (p.dob as string | null) ?? null,
      lastVisit: last.get(id) ?? null,
      nextAppt: next.get(id) ?? null,
      balance: Number((owed.get(id) ?? 0).toFixed(3)),
      allergies: allergyOf.get(id) ?? [],
      chronic: chronicOf.get(id) ?? [],
    };
  });

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">PATIENTS</p>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">المرضى</h1>
          <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
            ابحث وأنت على الهاتف — الرصيد وآخر زيارة والموعد القادم في السطر نفسه
          </p>
        </div>
        <Link href="/reception/book" className="btn-primary">
          <UserPlus className="w-4 h-4" /> مريض جديد وحجز
        </Link>
      </div>

      <PatientDirectory patients={patients} />
    </div>
  );
}
