import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppointmentsBoard, type ApptRow } from "@/components/doctor/appointments-board";

export const metadata = { title: "مواعيدي — طود" };
export const dynamic = "force-dynamic";

type Joined = { name: string; phone: string | null } | null;

export default async function DoctorAppointmentsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const sb = await createServerSupabaseClient();

  /* Ninety days back and ninety forward. The page used to start at today, so a
     doctor could not re-read the visit from last Tuesday — the single most
     common reason to open a diary at all. */
  const from = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 90 * 86_400_000).toISOString();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Muscat", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const { data } = await sb
    .from("appointments")
    .select("id, slot_time, status, patient_id, duration_minutes, patients(name, phone), services(name_ar)")
    .eq("doctor_id", claims.sub)
    .is("deleted_at", null)
    .gte("slot_time", from)
    .lte("slot_time", to)
    .order("slot_time")
    .limit(1000);

  const rows = data ?? [];
  const patientIds = [...new Set(rows.map((r) => r.patient_id as string).filter(Boolean))];

  /* Allergies and chronic conditions travel with the row. A doctor scanning
     next week's list should see the flag there, not after opening the file. */
  const { data: hist } = patientIds.length
    ? await sb.from("medical_histories")
        .select("patient_id, allergies, chronic_diseases").in("patient_id", patientIds)
    : { data: [] as Record<string, unknown>[] };

  const allergyOf = new Map<string, string[]>();
  const chronicOf = new Map<string, string[]>();
  for (const h of hist ?? []) {
    const pid = h.patient_id as string;
    const a = (h.allergies as string[] | null) ?? [];
    const c = (h.chronic_diseases as string[] | null) ?? [];
    if (a.length) allergyOf.set(pid, a);
    if (c.length) chronicOf.set(pid, c);
  }

  const appts: ApptRow[] = rows.map((r) => {
    const p = r.patients as unknown as Joined;
    const pid = r.patient_id as string;
    return {
      id: r.id as string,
      slotTime: r.slot_time as string,
      status: r.status as string,
      patientId: pid,
      patientName: p?.name ?? "مريض",
      patientPhone: p?.phone ?? null,
      service: (r.services as unknown as { name_ar: string } | null)?.name_ar ?? null,
      durationMinutes: (r.duration_minutes as number | null) ?? null,
      allergies: allergyOf.get(pid) ?? [],
      chronic: chronicOf.get(pid) ?? [],
    };
  });

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">SCHEDULE</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">مواعيدي</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          القادم والسابق — ابحث، صفِّ بالحالة أو الخدمة، وافتح ملف أي مريض
        </p>
      </div>

      <AppointmentsBoard rows={appts} todayKey={todayKey} />
    </div>
  );
}
