import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { PatientDirectory, type DirectoryPatient } from "@/components/reception/patient-directory";
import { UserPlus } from "lucide-react";
import { loadOpenReceivables, owedByPatient } from "@/lib/receivables";

export const metadata = { title: "المرضى — طود" };
export const dynamic = "force-dynamic";

/** Directory search filters client-side, so this is also the search horizon. */
const PATIENT_CAP = 5000;

export default async function ReceptionPatientsPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const [{ data: people }, { data: visits }, { data: future }, { data: hist }, invoices] =
    await Promise.all([
      /* Newest first, so if the cap bites it drops the oldest records
         rather than an arbitrary slice — and the UI says when it did. */
      sb.from("patients").select("id, name, phone, gender, dob")
        .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
        .order("created_at", { ascending: false }).limit(PATIENT_CAP),
      sb.from("appointments").select("patient_id, slot_time")
        .eq("clinic_id", claims.clinic_id).eq("status", "completed").is("deleted_at", null)
        .order("slot_time", { ascending: false }).limit(5000),
      sb.from("appointments").select("patient_id, slot_time")
        .eq("clinic_id", claims.clinic_id).in("status", ["scheduled", "confirmed"]).is("deleted_at", null)
        .gte("slot_time", nowIso).order("slot_time").limit(3000),
      sb.from("medical_histories").select("patient_id, allergies, chronic_diseases").limit(5000),
      /* What is still owed, so the desk can ask while the patient is here
         rather than posting a reminder next week. Net of payments and credit
         notes — the same helper the finance screens use. */
      loadOpenReceivables(sb, claims.clinic_id),
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
  const owed = owedByPatient(invoices);

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

      <PatientDirectory patients={patients} capped={(people ?? []).length >= PATIENT_CAP} />
    </div>
  );
}
