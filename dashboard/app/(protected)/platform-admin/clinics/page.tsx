import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { ClinicsManager, type ClinicRow } from "@/components/platform/clinics-manager";
import { Plus, Building2, Coins, AlertTriangle } from "lucide-react";

export const metadata = { title: "إدارة العيادات — طود" };
export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function ClinicsPage() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) redirect("/login");

  /* One aggregate instead of five queries plus a JavaScript reduction that
     silently mis-reported activity once more than a few clinics existed. */
  const sb = await createServiceRoleClient();
  const { data } = await sb.rpc("platform_clinic_overview");

  const clinics: ClinicRow[] = (data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: (c.name as string) ?? "",
    name_ar: (c.name_ar as string) ?? null,
    clinic_type: (c.clinic_type as string) ?? "general",
    status: (c.status as string) ?? "trial",
    plan: (c.plan as string) ?? "starter",
    staff_count: Number(c.staff_count ?? 0),
    patient_count: Number(c.patient_count ?? 0),
    appts_30d: Number(c.appts_30d ?? 0),
    last_activity: (c.last_activity as string) ?? null,
    sub_status: (c.sub_status as string) ?? null,
    mrr: Number(c.mrr ?? 0),
    period_end: (c.period_end as string) ?? null,
    whatsapp_linked: !!c.whatsapp_linked,
  }));

  const live = clinics.filter((c) => c.status === "active");
  const mrr = live.reduce((s, c) => s + c.mrr, 0);
  /* Clinics that have never done anything, or nothing in a week. This is the
     number that predicts churn, so it sits next to the revenue it threatens. */
  const quiet = clinics.filter((c) => {
    if (c.status !== "active" && c.status !== "trial") return false;
    if (!c.last_activity) return true;
    return Date.now() - new Date(c.last_activity).getTime() >= 7 * 86_400_000;
  }).length;

  const kpis = [
    { label: "عيادات نشطة", value: String(live.length), Icon: Building2, color: "var(--accent-1)" },
    { label: "الدخل الشهري (ر.ع)", value: fmt(mrr), Icon: Coins, color: "var(--accent-1)" },
    { label: "خاملة ٧ أيام+", value: String(quiet), Icon: AlertTriangle, color: quiet > 0 ? "#fbbf24" : "var(--text-3)" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">CLINICS</p>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">إدارة العيادات</h1>
          <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
            كل عميل، حالته، استخدامه، وما يدفعه — وتحكّم مباشر من الجدول
          </p>
        </div>
        <Link href="/platform-admin/clinics/new" className="btn-primary">
          <Plus className="w-4 h-4" /> إضافة عيادة
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.7rem", color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <ClinicsManager clinics={clinics} />
    </div>
  );
}
