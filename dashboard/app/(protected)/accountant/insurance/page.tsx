import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  InsuranceReceivables, type ClaimRow,
} from "@/components/accountant/insurance-receivables";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "مستحقات التأمين — طود" };
export const dynamic = "force-dynamic";

/* Money owed by insurers is money owed.

   Claims lived under the manager's insurance module as a workflow — submit,
   approve, reject — and never as a receivable. So the accountant's outstanding
   figure counted what patients owe and silently ignored what insurers owe, which
   in an insured clinic is most of it.

   The second thing this page exists for is worse. When an insurer REJECTS a
   claim, the amount falls back on the patient — and nothing in the product ever
   said so. The invoice sat there unpaid, the claim sat there rejected, and no
   screen connected the two, so the money was never chased by anyone. */
export default async function InsuranceReceivablesPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();

  const { data: rows } = await sb
    .from("insurance_claims")
    .select("id, status, claim_ref, submitted_amount, approved_amount, submitted_at, created_at, resolved_at, rejection_reason, invoice_id, patient_id, patients!patient_id(name, phone), insurance_providers!provider_id(provider_name_ar, provider_name), invoices!invoice_id(invoice_number, total, net_total)")
    .eq("clinic_id", claims.clinic_id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1000);

  const now = Date.now();

  const list: ClaimRow[] = (rows ?? []).map((c) => {
    const p = c.patients as unknown as { name?: string; phone?: string | null } | null;
    const prov = c.insurance_providers as unknown as
      { provider_name_ar?: string; provider_name?: string } | null;
    const inv = c.invoices as unknown as
      { invoice_number?: string; total?: number; net_total?: number } | null;
    /* Aged from when it was sent, not when it was created — an unsent claim is
       the clinic's own delay and belongs in a different conversation. */
    const from = (c.submitted_at as string | null) ?? (c.created_at as string);
    return {
      id: c.id as string,
      status: c.status as string,
      claimRef: (c.claim_ref as string | null) ?? null,
      submitted: Number(c.submitted_amount ?? 0),
      approved: c.approved_amount != null ? Number(c.approved_amount) : null,
      patientId: (c.patient_id as string | null) ?? null,
      patientName: p?.name ?? "—",
      providerName: prov?.provider_name_ar ?? prov?.provider_name ?? "—",
      invoiceId: (c.invoice_id as string | null) ?? null,
      invoiceNumber: inv?.invoice_number ?? null,
      invoiceTotal: Number(inv?.net_total ?? inv?.total ?? 0),
      ageDays: Math.floor((now - new Date(from).getTime()) / 86_400_000),
      rejectionReason: (c.rejection_reason as string | null) ?? null,
      resolvedAt: (c.resolved_at as string | null) ?? null,
    };
  });

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <Link href="/accountant" className="inline-flex items-center gap-1.5 text-xs"
        style={{ color: "var(--text-3)" }}>
        <ArrowRight className="w-3.5 h-3.5" /> رجوع للوحة المالية
      </Link>

      <div>
        <p className="eyebrow">INSURANCE RECEIVABLES</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">مستحقات التأمين</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          ما على شركات التأمين — والمطالبات المرفوضة التي رجعت على المريض
        </p>
      </div>

      <InsuranceReceivables claims={list} />
    </div>
  );
}
