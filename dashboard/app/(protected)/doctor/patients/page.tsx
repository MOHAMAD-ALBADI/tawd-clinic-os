import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { UserCircle } from "lucide-react";

export const metadata = { title: "مرضاي — طود" };

type ApptRow = { patients: unknown; slot_time: string };
type PatientJ = { id: string; name: string; phone?: string };

export default async function DoctorPatientsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("appointments")
    .select("slot_time, patients(id, name, phone)")
    .eq("clinic_id", claims.clinic_id)
    .eq("doctor_id", claims.sub)
    .order("slot_time", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as ApptRow[];
  const seen = new Set<string>();
  const patients: Array<PatientJ & { last_visit: string }> = [];
  for (const r of rows) {
    const p = r.patients as PatientJ | null;
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      patients.push({ ...p, last_visit: r.slot_time });
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>مرضاي</h2>
        <p className="text-sm mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          {patients.length} مريض في سجلاتك
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
      >
        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <UserCircle className="w-10 h-10" style={{ color: "hsl(var(--muted-foreground))" }} />
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>لا يوجد مرضى حتى الآن</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(var(--muted) / 0.4)", borderBottom: "1px solid hsl(var(--border))" }}>
                {["المريض", "رقم الجوال", "آخر زيارة"].map((h) => (
                  <th key={h} className="text-right py-3 px-5 text-[12px] font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < patients.length - 1 ? "1px solid hsl(var(--border))" : undefined }}>
                  <td className="py-3.5 px-5 font-semibold" style={{ color: "hsl(var(--foreground))" }}>{p.name}</td>
                  <td className="py-3.5 px-5 ltr-nums" style={{ color: "hsl(var(--muted-foreground))" }}>{p.phone ?? "—"}</td>
                  <td className="py-3.5 px-5 ltr-nums" style={{ color: "hsl(var(--muted-foreground))" }}>{formatDate(p.last_visit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
