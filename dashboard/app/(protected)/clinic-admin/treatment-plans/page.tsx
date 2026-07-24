import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TreatmentPlansManager, type PlanRow, type ItemRow, type Opt, type SvcOpt } from "@/components/treatment/treatment-plans-manager";
import { ClipboardList, ListChecks, Coins, CheckCircle2 } from "lucide-react";

export const metadata = { title: "خطط العلاج — طود" };

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);
type J = { name?: string; name_ar?: string } | null;

export default async function TreatmentPlansPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const [planRes, itemRes, patRes, docRes, svcRes] = await Promise.all([
    sb.from("treatment_plans")
      .select("id, title, status, total_estimate, patients!patient_id(name, name_ar), tawd_staff_users!doctor_id(name, name_ar)")
      .eq("clinic_id", claims.clinic_id).order("created_at", { ascending: false }).limit(100),
    sb.from("treatment_plan_items")
      .select("id, plan_id, description, tooth_number, quantity, unit_price, line_total, status")
      .eq("clinic_id", claims.clinic_id).order("sort_order"),
    sb.from("patients").select("id, name, name_ar").eq("clinic_id", claims.clinic_id).is("deleted_at", null).order("name").limit(500),
    sb.from("tawd_staff_users").select("id, name, name_ar").eq("clinic_id", claims.clinic_id).eq("role", "doctor").eq("is_active", true).is("deleted_at", null),
    sb.from("services").select("id, name, name_ar, price").eq("clinic_id", claims.clinic_id).eq("is_active", true).order("name_ar"),
  ]);

  const itemsByPlan = new Map<string, ItemRow[]>();
  for (const it of itemRes.data ?? []) {
    const row: ItemRow = {
      id: it.id, description: it.description, tooth_number: (it.tooth_number as string) ?? "",
      quantity: n(it.quantity), unit_price: n(it.unit_price), line_total: n(it.line_total),
      status: (it.status as string) === "done" ? "done" : "pending",
    };
    const arr = itemsByPlan.get(it.plan_id) ?? [];
    arr.push(row); itemsByPlan.set(it.plan_id, arr);
  }

  const plans: PlanRow[] = (planRes.data ?? []).map((p) => {
    const pt = p.patients as unknown as J; const dc = p.tawd_staff_users as unknown as J;
    return {
      id: p.id, title: p.title, status: p.status as PlanRow["status"], total_estimate: n(p.total_estimate),
      patient_name: pt?.name_ar ?? pt?.name ?? "مريض", doctor_name: dc?.name_ar ?? dc?.name ?? "",
      items: itemsByPlan.get(p.id) ?? [],
    };
  });

  const patients: Opt[] = (patRes.data ?? []).map((p) => ({ id: p.id, label: (p.name_ar ?? p.name) as string }));
  const doctors: Opt[] = (docRes.data ?? []).map((d) => ({ id: d.id, label: (d.name_ar ?? d.name) as string }));
  const services: SvcOpt[] = (svcRes.data ?? []).map((s) => ({ id: s.id, label: (s.name_ar ?? s.name) as string, price: n(s.price) }));

  const active = plans.filter((p) => ["proposed", "accepted", "in_progress"].includes(p.status));
  const proposedVal = plans.filter((p) => p.status === "proposed").reduce((s, p) => s + p.total_estimate, 0);
  const acceptedVal = plans.filter((p) => ["accepted", "in_progress", "completed"].includes(p.status)).reduce((s, p) => s + p.total_estimate, 0);

  const kpis = [
    { label: "خطط نشطة", value: String(active.length), Icon: ListChecks, color: "var(--accent-1)" },
    { label: "إجمالي الخطط", value: String(plans.length), Icon: ClipboardList, color: "var(--accent-1)" },
    { label: "قيمة مقترحة (ر.ع)", value: fmt(proposedVal), Icon: Coins, color: "#fbbf24" },
    { label: "قيمة مقبولة (ر.ع)", value: fmt(acceptedVal), Icon: CheckCircle2, color: "#5dd9cb" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">TREATMENT PLANS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">خطط العلاج</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>خطط متعددة الزيارات مع تقدير التكلفة وموافقة المريض وتتبّع الإنجاز</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none text-white" style={{ fontSize: "1.7rem" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <TreatmentPlansManager plans={plans} patients={patients} doctors={doctors} services={services} />
    </div>
  );
}
