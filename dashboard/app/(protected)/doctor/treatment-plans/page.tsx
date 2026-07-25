import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { TreatmentPlansManager, type PlanRow, type ItemRow, type Opt, type SvcOpt } from "@/components/treatment/treatment-plans-manager";
import { ClipboardList, ListChecks, CheckCircle2 } from "lucide-react";

export const metadata = { title: "خطط علاجي — طود" };

const n = (v: unknown) => Number(v ?? 0) || 0;
type J = { name?: string; name_ar?: string } | null;

/* The doctor's own treatment plans. Scoped to doctor_id = the signed-in doctor,
   mirroring the isolation rule used by /doctor/patients — a doctor never sees
   another doctor's plans. Prices are shown because the doctor authors the quote. */
export default async function DoctorTreatmentPlansPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "doctor")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const [planRes, itemRes, svcRes] = await Promise.all([
    sb.from("treatment_plans")
      .select("id, title, status, total_estimate, patient_id, patients!patient_id(name, name_ar)")
      .eq("clinic_id", claims.clinic_id).eq("doctor_id", claims.sub)
      .order("created_at", { ascending: false }).limit(100),
    sb.from("treatment_plan_items")
      .select("id, plan_id, description, tooth_number, quantity, unit_price, line_total, status")
      .eq("clinic_id", claims.clinic_id).order("sort_order"),
    sb.from("services").select("id, name, name_ar, price")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).order("name_ar"),
  ]);

  const plans0 = planRes.data ?? [];
  const planIds = new Set(plans0.map((p) => p.id));

  const itemsByPlan = new Map<string, ItemRow[]>();
  for (const it of itemRes.data ?? []) {
    if (!planIds.has(it.plan_id)) continue; // only this doctor's plans
    const arr = itemsByPlan.get(it.plan_id) ?? [];
    arr.push({
      id: it.id, description: it.description, tooth_number: (it.tooth_number as string) ?? "",
      quantity: n(it.quantity), unit_price: n(it.unit_price), line_total: n(it.line_total),
      status: (it.status as string) === "done" ? "done" : "pending",
    });
    itemsByPlan.set(it.plan_id, arr);
  }

  const plans: PlanRow[] = plans0.map((p) => {
    const pt = p.patients as unknown as J;
    return {
      id: p.id, title: p.title, status: p.status as PlanRow["status"],
      total_estimate: n(p.total_estimate),
      patient_name: pt?.name_ar ?? pt?.name ?? "مريض",
      doctor_name: "", // always the viewer — no need to repeat it on every row
      items: itemsByPlan.get(p.id) ?? [],
    };
  });

  /* Patients this doctor actually treats — so a new plan can't be opened for
     someone else's patient. Derived from their appointments (same source
     /doctor/patients uses), deduped. */
  const { data: apptPatients } = await sb
    .from("appointments")
    .select("patient_id, patients!patient_id(name, name_ar)")
    .eq("clinic_id", claims.clinic_id).eq("doctor_id", claims.sub)
    .is("deleted_at", null).limit(2000);

  const seen = new Set<string>();
  const patients: Opt[] = [];
  for (const a of apptPatients ?? []) {
    if (!a.patient_id || seen.has(a.patient_id)) continue;
    seen.add(a.patient_id);
    const pt = a.patients as unknown as J;
    patients.push({ id: a.patient_id, label: pt?.name_ar ?? pt?.name ?? "مريض" });
  }
  patients.sort((a, b) => a.label.localeCompare(b.label));

  const services: SvcOpt[] = (svcRes.data ?? []).map((s) => ({
    id: s.id, label: (s.name_ar ?? s.name) as string, price: n(s.price),
  }));

  const active = plans.filter((p) => ["proposed", "accepted", "in_progress"].includes(p.status)).length;
  const completed = plans.filter((p) => p.status === "completed").length;

  const kpis = [
    { label: "خطط نشطة", value: String(active), Icon: ListChecks },
    { label: "إجمالي خططي", value: String(plans.length), Icon: ClipboardList },
    { label: "مكتملة", value: String(completed), Icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">MY TREATMENT PLANS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">خطط علاجي</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          خطط مرضاك متعددة الزيارات — أضف الإجراءات، اعرضها على المريض، وتابع الإنجاز
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            </div>
            <p className="font-black ltr-nums leading-none text-white" style={{ fontSize: "1.7rem" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <TreatmentPlansManager plans={plans} patients={patients} doctors={[]} services={services} />
    </div>
  );
}
