import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProvidersManager, type ProviderRow } from "@/components/insurance/providers-manager";
import { PatientInsuranceManager, type CoverageRow, type PatientOpt } from "@/components/insurance/patient-insurance-manager";
import { ClaimsBoard, type ClaimRow } from "@/components/insurance/claims-board";
import { ShieldCheck, Clock, CheckCircle2, Coins } from "lucide-react";

export const metadata = { title: "التأمين — طود" };

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);
type J = { name?: string; name_ar?: string } | null;
type JP = { provider_name?: string; provider_name_ar?: string } | null;

export default async function InsurancePage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const [provRes, claimRes, covRes, patRes] = await Promise.all([
    sb.from("insurance_providers")
      .select("id, provider_name, provider_name_ar, dhamani_code, contact_email, notes")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).order("provider_name"),
    sb.from("insurance_claims")
      .select("id, status, submitted_amount, approved_amount, claim_ref, rejection_reason, created_at, patient_id, appt_id, patients!patient_id(name, name_ar), insurance_providers!provider_id(provider_name, provider_name_ar)")
      .eq("clinic_id", claims.clinic_id).order("created_at", { ascending: false }).limit(100),
    sb.from("patient_insurance")
      .select("id, policy_number, coverage_percent, valid_until, patient_id, provider_id, patients!patient_id(name, name_ar), insurance_providers!provider_id(provider_name, provider_name_ar)")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).order("updated_at", { ascending: false }).limit(200),
    sb.from("patients").select("id, name, name_ar")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null).order("name").limit(500),
  ]);

  const providers: ProviderRow[] = (provRes.data ?? []).map((p) => ({
    id: p.id, provider_name: p.provider_name, provider_name_ar: (p.provider_name_ar as string) ?? "",
    dhamani_code: (p.dhamani_code as string) ?? "", contact_email: (p.contact_email as string) ?? "",
    notes: (p.notes as string) ?? "",
  }));
  const patients: PatientOpt[] = (patRes.data ?? []).map((p) => ({ id: p.id, name: (p.name_ar ?? p.name) as string }));

  const claimRows: ClaimRow[] = (claimRes.data ?? []).map((c) => {
    const pt = c.patients as unknown as J; const pr = c.insurance_providers as unknown as JP;
    return {
      id: c.id, status: c.status as ClaimRow["status"],
      submitted_amount: n(c.submitted_amount), approved_amount: n(c.approved_amount),
      claim_ref: (c.claim_ref as string) ?? "", rejection_reason: (c.rejection_reason as string) ?? "",
      patient_name: pt?.name_ar ?? pt?.name ?? "مريض",
      provider_name: pr?.provider_name_ar ?? pr?.provider_name ?? "مزوّد",
    };
  });
  const coverage: CoverageRow[] = (covRes.data ?? []).map((c) => {
    const pt = c.patients as unknown as J; const pr = c.insurance_providers as unknown as JP;
    return {
      id: c.id, policy_number: (c.policy_number as string) ?? "", coverage_percent: n(c.coverage_percent),
      valid_until: (c.valid_until as string) ?? "",
      patient_name: pt?.name_ar ?? pt?.name ?? "مريض",
      provider_name: pr?.provider_name_ar ?? pr?.provider_name ?? "مزوّد",
    };
  });

  const active = claimRows.filter((c) => c.status === "pending" || c.status === "submitted");
  const approved = claimRows.filter((c) => c.status === "approved");
  const outstanding = active.reduce((s, c) => s + c.submitted_amount, 0);
  const approvedSum = approved.reduce((s, c) => s + (c.approved_amount || c.submitted_amount), 0);

  const kpis = [
    { label: "قيد المعالجة", value: String(active.length), Icon: Clock, color: "#fbbf24" },
    { label: "معتمدة", value: String(approved.length), Icon: CheckCircle2, color: "#5dd9cb" },
    { label: "مستحق من التأمين (ر.ع)", value: fmt(outstanding), Icon: Coins, color: "#fbbf24" },
    { label: "معتمد محصّل (ر.ع)", value: fmt(approvedSum), Icon: ShieldCheck, color: "#5dd9cb" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">INSURANCE</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">التأمين</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>المزوّدون، تغطية المرضى، والمطالبات — تُفتح مطالبة تلقائياً عند فوترة مريض مؤمَّن</p>
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

      <ClaimsBoard claims={claimRows} providers={providers} patients={patients} />
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <ProvidersManager providers={providers} />
        <PatientInsuranceManager coverage={coverage} providers={providers} patients={patients} />
      </div>
    </div>
  );
}
